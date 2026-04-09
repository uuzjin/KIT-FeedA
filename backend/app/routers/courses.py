import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..core.auth import get_current_user, require_instructor
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

router = APIRouter(prefix="/api/courses", tags=["courses"])


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
    return _format_course(result.data)


# ── 3.1.4 강의 수정 ────────────────────────────────────────────────────────────
@router.put("/{course_id}")
def update_course(
    course_id: str,
    payload: CourseUpdateRequest,
    current_user: dict = Depends(require_instructor),
):
    _require_instructor_of(course_id, current_user["id"])

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
    _require_instructor_of(course_id, current_user["id"])

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
    _require_instructor_of(course_id, current_user["id"])

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
    _require_instructor_of(course_id, current_user["id"])

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


# ── 3.2.1-B 초대 링크 생성 ────────────────────────────────────────────────────
@router.post("/{course_id}/invites", status_code=201)
def create_invite(
    course_id: str,
    payload: InviteCreateRequest,
    current_user: dict = Depends(require_instructor),
):
    _require_instructor_of(course_id, current_user["id"])

    token = secrets.token_urlsafe(32)
    result = supabase.table("course_invites").insert({
        "course_id": course_id,
        "created_by": current_user["id"],
        "token": token,
        "expires_at": payload.expiresAt,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="초대 링크 생성에 실패했습니다.")

    return {"token": token, "expiresAt": payload.expiresAt}


# ── 3.2.1-C 초대 링크로 수강 등록 ────────────────────────────────────────────
@router.post("/join", status_code=201)
def join_via_invite(payload: JoinCourseRequest, current_user: dict = Depends(get_current_user)):
    invite = (
        supabase.table("course_invites")
        .select("*")
        .eq("token", payload.token)
        .maybe_single()
        .execute()
    )
    if not invite.data:
        raise HTTPException(status_code=404, detail="유효하지 않은 초대 코드입니다.")

    expires_at = datetime.fromisoformat(invite.data["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="만료된 초대 링크입니다.")

    course_id = invite.data["course_id"]
    supabase.table("course_enrollments").upsert(
        {"course_id": course_id, "student_id": current_user["id"], "join_method": "INVITE"},
        on_conflict="course_id,student_id",
    ).execute()

    return {"message": "수강 등록이 완료되었습니다.", "courseId": course_id}


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
    _require_instructor_of(course_id, current_user["id"])
    supabase.table("course_enrollments").delete().eq("course_id", course_id).eq("student_id", student_id).execute()


# ── 3.2.4 수강생 참여 현황 ────────────────────────────────────────────────────
@router.get("/{course_id}/enrollments/participation")
def get_participation(course_id: str, current_user: dict = Depends(require_instructor)):
    _require_instructor_of(course_id, current_user["id"])

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
