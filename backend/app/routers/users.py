import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..core.auth import get_current_user, require_instructor
from ..core.errors import AppError
from ..core.storage import (
    ALLOWED_IMAGE_TYPES,
    BUCKET_PROFILES,
    MAX_IMAGE_SIZE,
    get_signed_url,
    upload_file,
)
from ..database import supabase
from ..schemas import AssignCoursesRequest, ProfileUpdateRequest, RoleUpdateRequest

router = APIRouter(prefix="/api/users", tags=["users"])


def _format_profile(row: dict) -> dict:
    path = row.get("profile_image_path")
    image_url: str | None = None
    if path:
        try:
            image_url = get_signed_url(BUCKET_PROFILES, path, expires_in=3600)
        except Exception:
            image_url = None  # 서명 URL 생성 실패 시 None 반환

    return {
        "userId": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "title": row.get("title"),
        "profileImageUrl": image_url,
        "createdAt": row.get("created_at"),
    }


# ── 2.1.1 프로필 조회 ──────────────────────────────────────────────────────────
@router.get("/{user_id}/profile")
def get_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    # 본인 또는 ADMIN만 조회 가능
    if current_user["id"] != user_id and current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="해당 리소스에 대한 권한이 없습니다.")

    result = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    return _format_profile(result.data)


# ── 2.1.2 프로필 수정 ──────────────────────────────────────────────────────────
@router.put("/{user_id}/profile")
def update_profile(
    user_id: str,
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="본인 프로필만 수정할 수 있습니다.")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목을 하나 이상 입력하세요.")

    result = supabase.table("profiles").update(updates).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    return _format_profile(result.data[0])


# ── 2.1.1-B 프로필 이미지 업로드 ──────────────────────────────────────────────
@router.post("/{user_id}/profile/image")
async def upload_profile_image(
    user_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """프로필 이미지를 Supabase Storage에 업로드하고 Signed URL을 반환합니다."""
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="본인 프로필 이미지만 변경할 수 있습니다.")

    storage_path = f"{user_id}/{uuid.uuid4()}_{file.filename}"
    await upload_file(file, BUCKET_PROFILES, storage_path, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE)

    supabase.table("profiles").update({"profile_image_path": storage_path}).eq("id", user_id).execute()

    signed_url = get_signed_url(BUCKET_PROFILES, storage_path, expires_in=3600)
    return {"profileImageUrl": signed_url}


# ── 2.1.3 담당 과목 등록 (강사) ────────────────────────────────────────────────
@router.post("/{user_id}/courses")
def assign_courses(
    user_id: str,
    payload: AssignCoursesRequest,
    current_user: dict = Depends(require_instructor),
):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 담당 과목만 등록할 수 있습니다.")

    course_ids = payload.courseIds
    if not course_ids:
        raise HTTPException(status_code=400, detail="courseIds가 비어 있습니다.")

    rows = [
        {"course_id": cid, "instructor_id": user_id, "is_primary": False}
        for cid in course_ids
    ]
    result = supabase.table("course_instructors").upsert(rows, on_conflict="course_id,instructor_id").execute()

    assigned = supabase.table("courses").select("id, course_name, semester").in_("id", course_ids).execute()
    return {
        "assignedCourses": [
            {"courseId": r["id"], "courseName": r["course_name"], "semester": r["semester"]}
            for r in (assigned.data or [])
        ],
        "totalCount": len(assigned.data or []),
    }


# ── 2.1.4 담당/수강 과목 조회 ──────────────────────────────────────────────────
@router.get("/{user_id}/courses")
def get_user_courses(
    user_id: str,
    semester: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    if current_user["id"] != user_id and current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="해당 리소스에 대한 권한이 없습니다.")

    profile = supabase.table("profiles").select("role").eq("id", user_id).maybe_single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    role = profile.data["role"]

    if role == "INSTRUCTOR":
        q = (
            supabase.table("course_instructors")
            .select("courses(id, course_name, semester, max_students)")
            .eq("instructor_id", user_id)
        )
        result = q.execute()
        courses = [r["courses"] for r in (result.data or []) if r.get("courses")]
    else:
        q = (
            supabase.table("course_enrollments")
            .select("courses(id, course_name, semester, max_students)")
            .eq("student_id", user_id)
        )
        result = q.execute()
        courses = [r["courses"] for r in (result.data or []) if r.get("courses")]

    if semester:
        courses = [c for c in courses if c.get("semester") == semester]

    formatted = [
        {
            "courseId": c["id"],
            "courseName": c["course_name"],
            "semester": c["semester"],
            "maxStudents": c.get("max_students"),
        }
        for c in courses
    ]
    return {"courses": formatted, "totalCount": len(formatted)}


# ── 2.2.1 역할 수정 (ADMIN 전용) ───────────────────────────────────────────────
@router.put("/{user_id}/role")
def update_role(
    user_id: str,
    payload: RoleUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "ADMIN":
        raise AppError(403, "ADMIN_ONLY", "역할 변경은 ADMIN만 가능합니다.")

    valid_roles = {"INSTRUCTOR", "STUDENT", "ADMIN"}
    if payload.role not in valid_roles:
        raise AppError(400, "INVALID_ROLE", f"유효하지 않은 역할입니다. 허용값: {valid_roles}")

    result = supabase.table("profiles").update({"role": payload.role}).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    row = result.data[0]
    return {"userId": row["id"], "role": row["role"], "updatedAt": row["updated_at"]}


# ── 계정 탈퇴 (Soft Delete) ────────────────────────────────────────────────────
@router.delete("/{user_id}")
def delete_account(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="본인 계정만 탈퇴할 수 있습니다.")

    from datetime import datetime, timezone
    supabase.table("profiles").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", user_id).execute()
    return {"message": "계정 탈퇴 처리되었습니다. 30일 후 영구 삭제됩니다."}
