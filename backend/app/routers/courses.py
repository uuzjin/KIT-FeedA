import csv
import io
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile

from ..core.auth import get_current_user, require_instructor
from ..core.config import settings
from ..database import supabase
from ..dependencies import require_instructor_of
from ..schemas import (
    CourseCreateRequest,
    CourseUpdateRequest,
    EnrollStudentsRequest,
    InviteCreateRequest,
    JoinCourseRequest,
    ScheduleCreateRequest,
    ScheduleUpdateRequest,
)

router = APIRouter()


def _format_course(row: dict) -> dict:
    return {
        "courseId": row["id"],
        "courseName": row["course_name"],
        "semester": row["semester"],
        "dayOfWeek": row.get("day_of_week", []),
        "startTime": row.get("start_time"),
        "endTime": row.get("end_time"),
        "maxStudents": row.get("max_students"),
        "description": row.get("description"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _create_notification(user_id: str, notification_type: str, title: str, body: str, metadata: dict) -> None:
    supabase.table("notifications").insert({
        "user_id": user_id,
        "notification_type": notification_type,
        "title": title,
        "body": body,
        "metadata": metadata,
        "is_read": False,
    }).execute()


def _execute_with_retry(builder, *, attempts: int = 2, delay_seconds: float = 0.2):
    last_error = None
    for attempt in range(attempts):
        try:
            # postgrest-py의 execute()는 성공 시 APIResponse 객체를 반환하며, 실패 시 예외를 던집니다.
            result = builder.execute()
            # result가 None인 경우는 거의 없으나, 만약 데이터가 없다면 .data가 []인 객체가 옵니다.
            return result
        except Exception as exc:
            last_error = exc
            # 이미 HTTPException인 경우 그대로 다시 던집니다.
            if isinstance(exc, HTTPException):
                raise exc
            
            # Postgrest 에러 메시지 분석
            error_msg = str(exc).lower()
            if "row level security" in error_msg or "permission denied" in error_msg or "403" in error_msg:
                raise HTTPException(
                    status_code=403, 
                    detail="데이터베이스 접근 권한이 없습니다. Supabase RLS 정책을 확인하거나 SERVICE_KEY 설정을 확인해주세요."
                ) from exc
            
            if "duplicate key" in error_msg or "unique constraint" in error_msg or "409" in error_msg:
                raise HTTPException(status_code=409, detail="이미 등록된 정보이거나 중복된 데이터입니다.") from exc

        if attempt < attempts - 1:
            time.sleep(delay_seconds)

    # 모든 재시도 실패 시
    if last_error is not None:
        # 실제 에러 메시지를 detail에 포함하여 프론트에서 확인할 수 있게 함
        detail_msg = str(last_error)
        raise HTTPException(
            status_code=500,
            detail=f"데이터베이스 통신 오류: {detail_msg}",
        ) from last_error
    
    raise HTTPException(status_code=500, detail="데이터베이스로부터 응답을 받지 못했습니다. 설정(URL/Key)을 확인해주세요.")


def _notify_invite_acceptance(course_id: str, course_name: str, student_id: str) -> None:
    metadata = {"courseId": course_id, "studentId": student_id}

    try:
        # 알림 생성은 실패해도 핵심 로직(수강 등록)에 영향을 주지 않도록 예외 처리
        supabase.table("notifications").insert({
            "user_id": student_id,
            "notification_type": "SYSTEM",
            "title": "강의 참여 완료",
            "body": f"'{course_name}' 강의에 참여했습니다.",
            "metadata": metadata,
            "is_read": False,
        }).execute()

        # 강사들에게 알림 전송
        instructor_rows = (
            supabase.table("course_instructors")
            .select("instructor_id")
            .eq("course_id", course_id)
            .execute()
        ).data or []

        profile_row = (
            supabase.table("profiles")
            .select("name")
            .eq("id", student_id)
            .maybe_single()
            .execute()
        )
        student_name = (profile_row.data or {}).get("name") or "학생"

        for row in instructor_rows:
            instructor_id = row.get("instructor_id")
            if not instructor_id: continue
            try:
                supabase.table("notifications").insert({
                    "user_id": instructor_id,
                    "notification_type": "SYSTEM",
                    "title": "새로운 학생 참여",
                    "body": f"{student_name} 학생이 '{course_name}' 강의에 참여했습니다.",
                    "metadata": metadata,
                    "is_read": False,
                }).execute()
            except Exception:
                continue
    except Exception as e:
        print(f"Notification error: {e}")
        return


def _accept_invite_for_user(current_user: dict, token: str, expected_course_id: str | None) -> dict:
    if current_user.get("role") != "STUDENT":
        raise HTTPException(status_code=403, detail="학생 계정만 초대 링크로 수강 등록할 수 있습니다.")

    # 1. 초대장 존재 여부 확인
    invite_res = _execute_with_retry(
        supabase.table("course_invites")
        .select("*")
        .eq("token", token)
        .maybe_single()
    )
    if not invite_res or not invite_res.data:
        raise HTTPException(status_code=404, detail="유효하지 않은 초대 코드입니다. 링크를 다시 확인해주세요.")

    invite_data = invite_res.data
    course_id = invite_data["course_id"]

    # 2. 강의 ID 검증 (경로 파라미터가 있는 경우)
    if expected_course_id is not None and str(course_id) != str(expected_course_id):
        raise HTTPException(status_code=400, detail="초대 링크가 이 강의와 일치하지 않습니다.")

    # 3. 만료 체크
    expires_raw = invite_data.get("expires_at")
    if expires_raw:
        expires_at = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="만료된 초대 링크입니다. 강사에게 새 링크를 요청해주세요.")

    # 4. 이미 수강 등록된 학생인지 확인
    existing_enroll = _execute_with_retry(
        supabase.table("course_enrollments")
        .select("id")
        .eq("course_id", course_id)
        .eq("student_id", current_user["id"])
        .maybe_single()
    )
    if existing_enroll and existing_enroll.data:
        raise HTTPException(status_code=409, detail="이미 이 강의에 수강 등록되어 있습니다.")

    # 5. 수강 등록 실행
    try:
        _execute_with_retry(
            supabase.table("course_enrollments").insert({
                "course_id": course_id,
                "student_id": current_user["id"],
                "join_method": "INVITE"
            })
        )
    except HTTPException as e:
        if e.status_code == 409:
            raise HTTPException(status_code=409, detail="이미 이 강의에 등록된 수강생입니다.")
        raise e

    # 6. 강의 이름 조회 및 알림 처리
    course_res = _execute_with_retry(
        supabase.table("courses")
        .select("course_name")
        .eq("id", course_id)
        .maybe_single()
    )
    course_name = (course_res.data or {}).get("course_name") or "강의"
    
    # 비동기적으로 알림 처리 (필수는 아니나 별도 스레드나 태스크로 뺄 수 있음)
    _notify_invite_acceptance(course_id, course_name, current_user["id"])

    # 7. 등록 결과 조회 (joined_at)
    enroll_res = _execute_with_retry(
        supabase.table("course_enrollments")
        .select("joined_at")
        .eq("course_id", course_id)
        .eq("student_id", current_user["id"])
        .maybe_single()
    )
    joined_at = (enroll_res.data or {}).get("joined_at") or datetime.now(timezone.utc).isoformat()

    return {
        "message": f"'{course_name}' 강의에 성공적으로 등록되었습니다.",
        "courseId": course_id,
        "courseName": course_name,
        "joinedAt": joined_at,
    }


# ── 3.1.1 강의 생성 ────────────────────────────────────────────────────────────
@router.post("", status_code=201)
def create_course(payload: CourseCreateRequest, current_user: dict = Depends(require_instructor)):
    insert_data = {
        "course_name": payload.courseName,
        "semester": payload.semester,
        "day_of_week": payload.dayOfWeek,
        "start_time": payload.startTime,
        "end_time": payload.endTime,
        "max_students": payload.maxStudents,
        "description": payload.description,
    }
    result = supabase.table("courses").insert(insert_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="강의 생성에 실패했습니다.")

    course = result.data[0]
    # 생성자를 primary instructor로 자동 등록
    supabase.table("course_instructors").insert(
        {"course_id": course["id"], "instructor_id": current_user["id"], "is_primary": True}
    ).execute()

    # dashboard_snapshots 초기화
    supabase.table("dashboard_snapshots").insert({"course_id": course["id"]}).execute()

    return _format_course(course)


# ── 3.1.2 강의 목록 조회 ───────────────────────────────────────────────────────
@router.get("")
def list_courses(semester: str | None = None, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    role = current_user["role"]

    if role == "INSTRUCTOR":
        sub = (
            supabase.table("course_instructors")
            .select("course_id")
            .eq("instructor_id", user_id)
            .execute()
        )
        course_ids = [r["course_id"] for r in (sub.data or [])]
    else:
        sub = (
            supabase.table("course_enrollments")
            .select("course_id")
            .eq("student_id", user_id)
            .execute()
        )
        course_ids = [r["course_id"] for r in (sub.data or [])]

    if not course_ids:
        return {"courses": [], "totalCount": 0}

    q = supabase.table("courses").select("*").in_("id", course_ids)
    if semester:
        q = q.eq("semester", semester)

    result = q.execute()
    courses = [_format_course(r) for r in (result.data or [])]
    return {"courses": courses, "totalCount": len(courses)}


# ── 3.1.3 강의 상세 조회 ───────────────────────────────────────────────────────
@router.get("/{course_id}")
def get_course(course_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("courses").select("*").eq("id", course_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    
    course = _format_course(result.data)
    
    # 담당 교수 정보 조회
    instructor_result = supabase.table("course_instructors").select("instructor_id, profiles(name, email)").eq("course_id", course_id).maybe_single().execute()
    instructor = None
    if instructor_result.data:
        instructor = {
            "userId": instructor_result.data["instructor_id"],
            "name": instructor_result.data["profiles"]["name"] if instructor_result.data.get("profiles") else "",
            "email": instructor_result.data["profiles"]["email"] if instructor_result.data.get("profiles") else "",
        }
    
    # 현재 수강생 수 조회
    enrollments_result = supabase.table("course_enrollments").select("id", count=True).eq("course_id", course_id).execute()
    current_students = len(enrollments_result.data) if enrollments_result.data else 0
    
    course["instructor"] = instructor
    course["currentStudents"] = current_students
    return course


# ── 3.1.4 강의 수정 ────────────────────────────────────────────────────────────
@router.put("/{course_id}")
def update_course(
    course_id: str,
    payload: CourseUpdateRequest,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    updates = {}
    if payload.courseName is not None:
        updates["course_name"] = payload.courseName
    if payload.semester is not None:
        updates["semester"] = payload.semester
    if payload.dayOfWeek is not None:
        updates["day_of_week"] = payload.dayOfWeek
    if payload.startTime is not None:
        updates["start_time"] = payload.startTime
    if payload.endTime is not None:
        updates["end_time"] = payload.endTime
    if payload.maxStudents is not None:
        updates["max_students"] = payload.maxStudents
    if payload.description is not None:
        updates["description"] = payload.description

    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목을 하나 이상 입력하세요.")

    result = supabase.table("courses").update(updates).eq("id", course_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")

    return _format_course(result.data[0])


# ── 3.1.5 강의 삭제 ────────────────────────────────────────────────────────────
@router.delete("/{course_id}", status_code=204)
def delete_course(course_id: str, current_user: dict = Depends(require_instructor)):
    primary = (
        supabase.table("course_instructors")
        .select("id")
        .eq("course_id", course_id)
        .eq("instructor_id", current_user["id"])
        .eq("is_primary", True)
        .maybe_single()
        .execute()
    )
    if not primary.data:
        raise HTTPException(status_code=403, detail="대표 강사만 강의를 삭제할 수 있습니다.")

    supabase.table("courses").delete().eq("id", course_id).execute()


# ── 3.1.6 스케줄 등록 ─────────────────────────────────────────────────────────
@router.post("/{course_id}/schedules", status_code=201)
def create_schedule(
    course_id: str,
    payload: ScheduleCreateRequest,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    result = supabase.table("course_schedules").insert({
        "course_id": course_id,
        "week_number": payload.weekNumber,
        "topic": payload.topic,
        "date": payload.date,
        "description": payload.description,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=409, detail="이미 해당 주차 스케줄이 존재합니다.")

    row = result.data[0]
    return {
        "scheduleId": row["id"],
        "courseId": course_id,
        "weekNumber": row["week_number"],
        "topic": row["topic"],
        "date": row.get("date"),
        "description": row.get("description"),
        "createdAt": row["created_at"],
    }


# ── 3.1.7 스케줄 목록 조회 ────────────────────────────────────────────────────
@router.get("/{course_id}/schedules")
def list_schedules(course_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("course_schedules")
        .select("*")
        .eq("course_id", course_id)
        .order("week_number")
        .execute()
    )
    schedules = [
        {
            "scheduleId": r["id"],
            "weekNumber": r["week_number"],
            "topic": r["topic"],
            "date": r.get("date"),
            "description": r.get("description"),
        }
        for r in (result.data or [])
    ]
    return {"schedules": schedules, "totalCount": len(schedules)}


# ── 3.1.8 스케줄 수정 ─────────────────────────────────────────────────────────
@router.put("/{course_id}/schedules/{schedule_id}")
def update_schedule(
    course_id: str,
    schedule_id: str,
    payload: ScheduleUpdateRequest,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목을 하나 이상 입력하세요.")

    # snake_case 변환
    mapped = {}
    if "topic" in updates:
        mapped["topic"] = updates["topic"]
    if "date" in updates:
        mapped["date"] = updates["date"]
    if "description" in updates:
        mapped["description"] = updates["description"]

    result = (
        supabase.table("course_schedules")
        .update(mapped)
        .eq("id", schedule_id)
        .eq("course_id", course_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다.")

    row = result.data[0]
    return {
        "scheduleId": row["id"],
        "weekNumber": row["week_number"],
        "topic": row["topic"],
        "date": row.get("date"),
        "description": row.get("description"),
        "updatedAt": row["updated_at"],
    }


# ── 3.2.1 수강생 일괄 등록 ────────────────────────────────────────────────────
@router.post("/{course_id}/enrollments", status_code=201)
def enroll_students(
    course_id: str,
    payload: EnrollStudentsRequest,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    rows = [
        {"course_id": course_id, "student_id": sid, "join_method": "DIRECT"}
        for sid in payload.studentIds
    ]
    result = supabase.table("course_enrollments").upsert(
        rows, on_conflict="course_id,student_id"
    ).execute()

    return {
        "message": f"{len(rows)}명의 수강생이 등록되었습니다.",
        "enrolledCount": len(result.data or []),
    }


# ── 3.2.1-B 엑셀/CSV 파일로 수강생 일괄 등록 ────────────────────────────────
@router.post("/{course_id}/enrollments/upload", status_code=201)
async def enroll_students_from_file(
    course_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_instructor),
):
    """Excel(.xlsx) 또는 CSV 파일의 첫 번째 열에 있는 이메일 목록으로 수강생을 등록합니다."""
    require_instructor_of(course_id, current_user["id"])

    if file.content_type not in (
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream",  # 일부 브라우저에서 xlsx를 이렇게 보냄
    ) and not (file.filename or "").lower().endswith((".csv", ".xlsx")):
        raise HTTPException(status_code=400, detail="CSV 또는 Excel(.xlsx) 파일만 업로드할 수 있습니다.")

    content = await file.read()
    filename = (file.filename or "").lower()

    emails: list[str] = []

    if filename.endswith(".xlsx"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            for row in ws.iter_rows(min_row=1, values_only=True):
                cell = row[0] if row else None
                if cell and isinstance(cell, str) and "@" in cell:
                    emails.append(cell.strip().lower())
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Excel 파일 파싱 실패: {exc}")
    else:
        # CSV (UTF-8 또는 EUC-KR 시도)
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = content.decode("euc-kr")
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="파일 인코딩을 인식할 수 없습니다. UTF-8 또는 EUC-KR로 저장해 주세요.")

        reader = csv.reader(io.StringIO(text))
        for row in reader:
            cell = row[0].strip() if row else ""
            if "@" in cell:
                emails.append(cell.lower())

    if not emails:
        raise HTTPException(status_code=400, detail="파일에서 유효한 이메일 주소를 찾을 수 없습니다. 첫 번째 열에 이메일을 입력해 주세요.")

    # 이메일로 프로필 조회
    profiles_res = (
        supabase.table("profiles")
        .select("id, email")
        .in_("email", emails)
        .execute()
    )
    found = profiles_res.data or []
    found_map = {p["email"]: p["id"] for p in found}

    not_found_emails = [e for e in emails if e not in found_map]

    if not found:
        raise HTTPException(
            status_code=404,
            detail=f"파일의 이메일과 일치하는 사용자가 없습니다. 미등록 이메일: {not_found_emails[:5]}",
        )

    rows = [
        {"course_id": course_id, "student_id": uid, "join_method": "FILE"}
        for uid in found_map.values()
    ]
    result = supabase.table("course_enrollments").upsert(
        rows, on_conflict="course_id,student_id"
    ).execute()

    return {
        "message": f"{len(result.data or [])}명이 등록되었습니다.",
        "enrolledCount": len(result.data or []),
        "notFoundEmails": not_found_emails,
        "notFoundCount": len(not_found_emails),
    }


# ── 3.2.1-C 초대 링크 생성 ────────────────────────────────────────────────────
@router.post("/{course_id}/invites", status_code=201)
def create_invite(
    course_id: str,
    payload: InviteCreateRequest = Body(default_factory=InviteCreateRequest),
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    expires_at = payload.expiresAt
    if not expires_at:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    # 환경변수에서 가져온 실제 도메인 사용 (기본값 http://localhost:3000)
    base = settings.FRONTEND_BASE_URL.rstrip("/")

    for _ in range(5):
        token = secrets.token_urlsafe(32)
        result = supabase.table("course_invites").insert({
            "course_id": course_id,
            "created_by": current_user["id"],
            "token": token,
            "expires_at": expires_at,
        }).execute()
        if result.data:
            row = result.data[0]
            invite_link = f"{base}/join?token={token}"
            created_at = row.get("created_at") or datetime.now(timezone.utc).isoformat()
            return {
                "courseId": course_id,
                "inviteToken": token,
                "inviteLink": invite_link,
                "expiresAt": expires_at,
                "createdAt": created_at,
            }

    raise HTTPException(status_code=500, detail="초대 링크 생성에 실패했습니다. 잠시 후 다시 시도하세요.")


# ── 3.2.1-B-2 초대 미리보기 (토큰 정보 조회) ──────────────────────────────────
@router.get("/invites/{token}", status_code=200)
def get_invite_preview(token: str):
    """학생이 수강 등록 전 강의 정보를 미리 확인하는 엔드포인트."""
    invite = (
        supabase.table("course_invites")
        .select("course_id, expires_at, created_by")
        .eq("token", token)
        .maybe_single()
        .execute()
    )
    if not invite or not invite.data:
        raise HTTPException(status_code=404, detail="유효하지 않은 초대 코드입니다.")

    course_id = invite.data["course_id"]
    expires_raw = invite.data.get("expires_at")
    
    # 만료 체크
    is_expired = False
    if expires_raw:
        expires_at = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            is_expired = True

    # 강의 정보 및 강사 정보 조회
    course_row = (
        supabase.table("courses")
        .select("course_name, description")
        .eq("id", course_id)
        .maybe_single()
        .execute()
    )
    if not course_row.data:
        raise HTTPException(status_code=404, detail="강의 정보를 찾을 수 없습니다.")

    # 강사 정보 (초대 링크 생성자)
    instructor_row = (
        supabase.table("profiles")
        .select("name")
        .eq("id", invite.data["created_by"])
        .maybe_single()
        .execute()
    )
    instructor_name = instructor_row.data["name"] if instructor_row.data else "알 수 없는 강사"

    return {
        "courseId": course_id,
        "courseName": course_row.data["course_name"],
        "description": course_row.data["description"],
        "instructorName": instructor_name,
        "expiresAt": expires_raw,
        "isExpired": is_expired,
    }


# ── 3.2.1-C 초대 링크로 수강 등록 (토큰만) ────────────────────────────────────
@router.post("/join", status_code=201)
def join_via_invite(payload: JoinCourseRequest, current_user: dict = Depends(get_current_user)):
    return _accept_invite_for_user(current_user, payload.token, None)


# ── 3.2.1-C-2 초대 링크로 수강 등록 (경로에 courseId·token; API 명세) ───────────
@router.post("/{course_id}/invites/{token}/accept", status_code=201)
def accept_invite_path(
    course_id: str,
    token: str,
    current_user: dict = Depends(get_current_user),
):
    return _accept_invite_for_user(current_user, token, course_id)


# ── 3.2.2 수강생 목록 조회 ────────────────────────────────────────────────────
@router.get("/{course_id}/enrollments")
def list_enrollments(course_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("course_enrollments")
        .select("student_id, join_method, joined_at, profiles(name, email)")
        .eq("course_id", course_id)
        .execute()
    )
    students = [
        {
            "studentId": r["student_id"],
            "name": r["profiles"]["name"] if r.get("profiles") else None,
            "email": r["profiles"]["email"] if r.get("profiles") else None,
            "joinMethod": r["join_method"],
            "joinedAt": r["joined_at"],
        }
        for r in (result.data or [])
    ]
    return {"students": students, "totalCount": len(students)}


# ── 3.2.3 수강생 삭제 ─────────────────────────────────────────────────────────
@router.delete("/{course_id}/enrollments/{student_id}", status_code=204)
def remove_enrollment(
    course_id: str,
    student_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    supabase.table("course_enrollments").delete().eq("course_id", course_id).eq("student_id", student_id).execute()


# ── 3.2.4 수강생 참여 현황 ────────────────────────────────────────────────────
@router.get("/{course_id}/enrollments/participation")
def get_participation(course_id: str, current_user: dict = Depends(require_instructor)):
    require_instructor_of(course_id, current_user["id"])

    enrollments = (
        supabase.table("course_enrollments")
        .select("student_id, profiles(name)")
        .eq("course_id", course_id)
        .execute()
    )
    quizzes = (
        supabase.table("quizzes")
        .select("id")
        .eq("course_id", course_id)
        .execute()
    )
    quiz_ids = [q["id"] for q in (quizzes.data or [])]
    total_quizzes = len(quiz_ids)

    participation = []
    for e in (enrollments.data or []):
        sid = e["student_id"]
        if quiz_ids:
            subs = (
                supabase.table("quiz_submissions")
                .select("id")
                .eq("student_id", sid)
                .in_("quiz_id", quiz_ids)
                .execute()
            )
            participated = len(subs.data or [])
        else:
            participated = 0

        participation.append({
            "studentId": sid,
            "name": e["profiles"]["name"] if e.get("profiles") else None,
            "participatedQuizzes": participated,
            "totalQuizzes": total_quizzes,
            "participationRate": round(participated / total_quizzes * 100, 1) if total_quizzes else 0.0,
        })

    return {"participation": participation, "totalStudents": len(participation)}
