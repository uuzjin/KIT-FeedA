from datetime import datetime, timedelta, timezone
from math import ceil

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.auth import get_current_user, require_instructor
from ..core.lms_client import get_lms_client
from ..database import supabase
from ..dependencies import require_instructor_of

deadlines_router = APIRouter(
    prefix="/api/courses/{course_id}/deadlines",
    tags=["reminders"],
)
settings_router = APIRouter(
    prefix="/api/users/{user_id}",
    tags=["reminders"],
)

_VALID_LMS = {"MOODLE", "CANVAS", "BLACKBOARD"}
_DEFAULT_REMINDER_SETTINGS = {
    "channels": ["IN_APP"],
    "hoursBefore": [24, 2],
    "quizNotifications": True,
    "materialNotifications": True,
    "updatedAt": None,
}


# ──────────────────────────────────────────────────────────────────────────────
# 헬퍼
# ──────────────────────────────────────────────────────────────────────────────

def _compute_deadline_status(due_at_str: str) -> tuple[str, int]:
    """due_at 문자열로 status(UPCOMING|OVERDUE)와 remainingHours 계산."""
    due = datetime.fromisoformat(due_at_str.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    diff_hours = (due - now).total_seconds() / 3600
    status = "UPCOMING" if diff_hours > 0 else "OVERDUE"
    return status, int(diff_hours)


def _format_deadline(row: dict) -> dict:
    status, remaining = _compute_deadline_status(row["due_at"])
    return {
        "deadlineId": row["id"],
        "courseId": row["course_id"],
        "scheduleId": row.get("schedule_id"),
        "deadlineType": row["deadline_type"],
        "title": row["title"],
        "description": row.get("description"),
        "dueAt": row["due_at"],
        "status": status,
        "remainingHours": remaining,
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
    }


def _format_reminder_settings(row: dict) -> dict:
    return {
        "channels": row.get("channels", ["IN_APP"]),
        "hoursBefore": row.get("hours_before", [24, 2]),
        "quizNotifications": row.get("quiz_notifications", True),
        "materialNotifications": row.get("material_notifications", True),
        "updatedAt": row.get("updated_at"),
    }


def _create_reminders_for_deadline(
    deadline_id: str,
    due_at_str: str,
    user_id: str,
    hours_list: list[int] | None = None,
    channels: list[str] | None = None,
) -> list[dict]:
    """reminder_settings(또는 인자)에 따라 reminders 레코드 생성 후 반환."""
    if hours_list is None or channels is None:
        settings_row = (
            supabase.table("reminder_settings")
            .select("channels, hours_before")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if settings_row.data:
            hours_list = hours_list or settings_row.data.get("hours_before") or [24, 2]
            channels = channels or settings_row.data.get("channels") or ["IN_APP"]
        else:
            hours_list = hours_list or [24, 2]
            channels = channels or ["IN_APP"]

    due_at = datetime.fromisoformat(due_at_str.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)

    rows = []
    for hours in hours_list:
        scheduled_at = due_at - timedelta(hours=hours)
        if scheduled_at <= now:
            continue
        for channel in channels:
            rows.append({
                "deadline_id": deadline_id,
                "user_id": user_id,
                "channel": channel,
                "hours_before": hours,
                "status": "PENDING",
                "scheduled_at": scheduled_at.isoformat(),
            })

    created = []
    if rows:
        result = supabase.table("reminders").insert(rows).execute()
        created = result.data or []
    return created


def _recreate_reminders(deadline_id: str, due_at_str: str, user_id: str) -> None:
    supabase.table("reminders").delete().eq("deadline_id", deadline_id).eq("status", "PENDING").execute()
    _create_reminders_for_deadline(deadline_id, due_at_str, user_id)


# ──────────────────────────────────────────────────────────────────────────────
# 7.1.1 LMS 마감일 동기화  POST /deadlines/lms-syncs
# ──────────────────────────────────────────────────────────────────────────────

class DeadlineLmsSyncRequest(BaseModel):
    lmsType: str    # MOODLE | CANVAS | BLACKBOARD


# literal path 먼저 등록 (/{deadline_id} 보다 앞에 와야 함)
@deadlines_router.post("/lms-syncs")
def sync_lms_deadlines(
    course_id: str,
    payload: DeadlineLmsSyncRequest,
    current_user: dict = Depends(require_instructor),
):
    """LMS의 자료 업로드 마감일을 자동 트래킹한다."""
    require_instructor_of(course_id, current_user["id"])

    if payload.lmsType not in _VALID_LMS:
        raise HTTPException(status_code=400, detail=f"lmsType은 {_VALID_LMS} 중 하나여야 합니다.")

    # 해당 강의의 LMS 동기화 이력에서 lms_course_id 조회
    sync_row = (
        supabase.table("lms_syncs")
        .select("lms_course_id")
        .eq("course_id", course_id)
        .eq("lms_type", payload.lmsType)
        .order("synced_at", desc=True)
        .limit(1)
        .execute()
    )
    if not sync_row.data:
        raise HTTPException(
            status_code=400,
            detail="이 강의에 대한 LMS 수강생 동기화 이력이 없습니다. 먼저 /lms-syncs로 수강생을 동기화하세요.",
        )
    lms_course_id = sync_row.data[0]["lms_course_id"]

    try:
        client = get_lms_client(payload.lmsType)
        lms_deadlines = client.get_deadlines(lms_course_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LMS 서버 연결 실패: {exc}")

    created_deadlines = []
    for ld in lms_deadlines:
        due_at = ld.get("due_at")
        title = ld.get("title", "LMS 마감일")
        if not due_at:
            continue

        result = supabase.table("deadlines").insert({
            "course_id": course_id,
            "deadline_type": "MATERIAL",
            "title": title,
            "due_at": due_at,
            "created_by": current_user["id"],
        }).execute()

        if result.data:
            dl = result.data[0]
            _create_reminders_for_deadline(dl["id"], dl["due_at"], current_user["id"])
            created_deadlines.append(_format_deadline(dl))

    return {
        "syncId": None,
        "syncedCount": len(created_deadlines),
        "deadlines": created_deadlines,
        "syncedAt": datetime.now(timezone.utc).isoformat(),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 7.1.3 수동 마감일 생성  POST /deadlines
# ──────────────────────────────────────────────────────────────────────────────

class DeadlineCreateRequest(BaseModel):
    deadlineType: str
    title: str
    dueAt: str
    scheduleId: str | None = None
    description: str | None = None


@deadlines_router.post("", status_code=201)
def create_deadline(
    course_id: str,
    payload: DeadlineCreateRequest,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    valid_types = {"QUIZ", "MATERIAL", "ASSIGNMENT", "CUSTOM"}
    if payload.deadlineType not in valid_types:
        raise HTTPException(status_code=400, detail=f"deadlineType은 {valid_types} 중 하나여야 합니다.")

    result = supabase.table("deadlines").insert({
        "course_id": course_id,
        "schedule_id": payload.scheduleId,
        "deadline_type": payload.deadlineType,
        "title": payload.title,
        "description": payload.description,
        "due_at": payload.dueAt,
        "created_by": current_user["id"],
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="마감일 생성에 실패했습니다.")

    deadline = result.data[0]
    _create_reminders_for_deadline(deadline["id"], deadline["due_at"], current_user["id"])
    return _format_deadline(deadline)


# ──────────────────────────────────────────────────────────────────────────────
# 7.1.2 마감일 목록 조회  GET /deadlines
# ──────────────────────────────────────────────────────────────────────────────

@deadlines_router.get("")
def list_deadlines(
    course_id: str,
    status: str | None = None,     # UPCOMING | OVERDUE
    current_user: dict = Depends(get_current_user),
):
    rows = (
        supabase.table("deadlines")
        .select("*")
        .eq("course_id", course_id)
        .order("due_at")
        .execute()
    ).data or []

    deadlines = [_format_deadline(r) for r in rows]

    # status 필터: due_at 계산값 기준
    if status:
        status_upper = status.upper()
        deadlines = [d for d in deadlines if d["status"] == status_upper]

    return {"deadlines": deadlines, "totalCount": len(deadlines)}


# ──────────────────────────────────────────────────────────────────────────────
# 마감일 상세  GET /deadlines/{deadline_id}
# ──────────────────────────────────────────────────────────────────────────────

@deadlines_router.get("/{deadline_id}")
def get_deadline(
    course_id: str,
    deadline_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = (
        supabase.table("deadlines")
        .select("*")
        .eq("id", deadline_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="마감일을 찾을 수 없습니다.")
    return _format_deadline(result.data)


# ──────────────────────────────────────────────────────────────────────────────
# 마감일 수정  PATCH /deadlines/{deadline_id}
# ──────────────────────────────────────────────────────────────────────────────

class DeadlinePatchRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    dueAt: str | None = None


@deadlines_router.patch("/{deadline_id}")
def patch_deadline(
    course_id: str,
    deadline_id: str,
    payload: DeadlinePatchRequest,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    updates: dict = {}
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.description is not None:
        updates["description"] = payload.description
    if payload.dueAt is not None:
        updates["due_at"] = payload.dueAt
    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목을 하나 이상 입력하세요.")

    result = (
        supabase.table("deadlines")
        .update(updates)
        .eq("id", deadline_id)
        .eq("course_id", course_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="마감일을 찾을 수 없습니다.")

    deadline = result.data[0]
    if payload.dueAt is not None:
        _recreate_reminders(deadline_id, deadline["due_at"], current_user["id"])
    return _format_deadline(deadline)


# ──────────────────────────────────────────────────────────────────────────────
# 마감일 삭제  DELETE /deadlines/{deadline_id}
# ──────────────────────────────────────────────────────────────────────────────

@deadlines_router.delete("/{deadline_id}", status_code=204)
def delete_deadline(
    course_id: str,
    deadline_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    supabase.table("deadlines").delete().eq("id", deadline_id).eq("course_id", course_id).execute()


# ──────────────────────────────────────────────────────────────────────────────
# 7.2.1 마감 알림 예약  POST /deadlines/{deadline_id}/reminders
# ──────────────────────────────────────────────────────────────────────────────

class ReminderScheduleRequest(BaseModel):
    remindBeforeHours: list[int] | None = None   # 기본: [48, 24]
    channels: list[str] | None = None            # EMAIL|KAKAO|PUSH|IN_APP


@deadlines_router.post("/{deadline_id}/reminders", status_code=201)
def schedule_reminders(
    course_id: str,
    deadline_id: str,
    payload: ReminderScheduleRequest,
    current_user: dict = Depends(require_instructor),
):
    """특정 마감일에 대한 알림을 수동으로 예약한다."""
    require_instructor_of(course_id, current_user["id"])

    deadline = (
        supabase.table("deadlines")
        .select("id, due_at")
        .eq("id", deadline_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not deadline.data:
        raise HTTPException(status_code=404, detail="마감일을 찾을 수 없습니다.")

    # 동일 조건 PENDING 리마인더 중복 방지 — 기존 PENDING 삭제 후 재생성
    supabase.table("reminders").delete().eq("deadline_id", deadline_id).eq("status", "PENDING").execute()

    created = _create_reminders_for_deadline(
        deadline_id,
        deadline.data["due_at"],
        current_user["id"],
        hours_list=payload.remindBeforeHours or [48, 24],
        channels=payload.channels,
    )

    return {
        "reminders": [
            {
                "reminderId": r["id"],
                "remindAt": r["scheduled_at"],
                "channel": r["channel"],
                "status": r["status"],
            }
            for r in created
        ]
    }


# ──────────────────────────────────────────────────────────────────────────────
# 리마인더 목록 조회  GET /deadlines/{deadline_id}/reminders
# ──────────────────────────────────────────────────────────────────────────────

@deadlines_router.get("/{deadline_id}/reminders")
def list_deadline_reminders(
    course_id: str,
    deadline_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    exists = (
        supabase.table("deadlines")
        .select("id")
        .eq("id", deadline_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not exists.data:
        raise HTTPException(status_code=404, detail="마감일을 찾을 수 없습니다.")

    reminders = (
        supabase.table("reminders")
        .select("*")
        .eq("deadline_id", deadline_id)
        .order("scheduled_at")
        .execute()
    ).data or []

    return {
        "reminders": [
            {
                "reminderId": r["id"],
                "channel": r["channel"],
                "hoursBefore": r["hours_before"],
                "status": r["status"],
                "scheduledAt": r["scheduled_at"],
                "sentAt": r.get("sent_at"),
            }
            for r in reminders
        ],
        "totalCount": len(reminders),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 7.2.2 마감 경과 긴급 알림  POST /deadlines/{deadline_id}/overdue-alerts
# ──────────────────────────────────────────────────────────────────────────────

@deadlines_router.post("/{deadline_id}/overdue-alerts")
def send_overdue_alert(
    course_id: str,
    deadline_id: str,
    current_user: dict = Depends(require_instructor),
):
    """마감 경과 시 교수자 긴급 알림 + 수강생 전체에 안내 알림 발송."""
    require_instructor_of(course_id, current_user["id"])

    deadline = (
        supabase.table("deadlines")
        .select("*")
        .eq("id", deadline_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not deadline.data:
        raise HTTPException(status_code=404, detail="마감일을 찾을 수 없습니다.")

    dl = deadline.data
    due_dt = datetime.fromisoformat(dl["due_at"].replace("Z", "+00:00"))
    if due_dt > datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="아직 마감 전인 항목에는 긴급 알림을 발송할 수 없습니다.")

    now_str = datetime.now(timezone.utc).isoformat()
    title = f"[긴급] '{dl['title']}' 마감 경과"
    instructor_body = f"'{dl['title']}' 마감이 경과했습니다. 학생 제출 현황을 확인하세요."
    student_body = f"'{dl['title']}' 마감이 경과했습니다. 담당 교수에게 문의하세요."

    # 교수자 알림
    instr_result = supabase.table("notifications").insert({
        "user_id": current_user["id"],
        "notification_type": "REMINDER",
        "title": title,
        "body": instructor_body,
        "metadata": {"deadlineId": deadline_id, "courseId": course_id},
        "is_read": False,
    }).execute()
    noti_id = instr_result.data[0]["id"] if instr_result.data else None

    # 수강생 전체 알림
    enrollments = (
        supabase.table("course_enrollments")
        .select("student_id")
        .eq("course_id", course_id)
        .execute()
    ).data or []

    student_rows = [
        {
            "user_id": e["student_id"],
            "notification_type": "REMINDER",
            "title": title,
            "body": student_body,
            "metadata": {"deadlineId": deadline_id, "courseId": course_id},
            "is_read": False,
        }
        for e in enrollments
    ]
    if student_rows:
        supabase.table("notifications").insert(student_rows).execute()

    return {
        "notificationId": noti_id,
        "notifiedInstructor": True,
        "notifiedStudentCount": len(enrollments),
        "sentAt": now_str,
    }


# ──────────────────────────────────────────────────────────────────────────────
# 리마인더 설정 CRUD  /api/users/{user_id}/reminder-settings
# ──────────────────────────────────────────────────────────────────────────────

class ReminderSettingsRequest(BaseModel):
    channels: list[str] | None = None
    hoursBefore: list[int] | None = None
    quizNotifications: bool | None = None
    materialNotifications: bool | None = None


@settings_router.get("/reminder-settings")
def get_reminder_settings(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    if user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="본인의 설정만 조회할 수 있습니다.")

    result = (
        supabase.table("reminder_settings")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return _DEFAULT_REMINDER_SETTINGS
    return _format_reminder_settings(result.data)


@settings_router.put("/reminder-settings")
def update_reminder_settings(
    user_id: str,
    payload: ReminderSettingsRequest,
    current_user: dict = Depends(get_current_user),
):
    if user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="본인의 설정만 수정할 수 있습니다.")

    valid_channels = {"EMAIL", "PUSH", "IN_APP", "KAKAO"}
    if payload.channels is not None:
        invalid = set(payload.channels) - valid_channels
        if invalid:
            raise HTTPException(status_code=400, detail=f"유효하지 않은 채널: {invalid}")

    row: dict = {"user_id": user_id}
    if payload.channels is not None:
        row["channels"] = payload.channels
    if payload.hoursBefore is not None:
        row["hours_before"] = payload.hoursBefore
    if payload.quizNotifications is not None:
        row["quiz_notifications"] = payload.quizNotifications
    if payload.materialNotifications is not None:
        row["material_notifications"] = payload.materialNotifications

    result = (
        supabase.table("reminder_settings")
        .upsert(row, on_conflict="user_id")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="리마인더 설정 저장에 실패했습니다.")
    return _format_reminder_settings(result.data[0])
