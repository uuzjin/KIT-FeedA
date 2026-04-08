from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from ..core.auth import get_current_user, require_instructor
from ..database import supabase

router = APIRouter(prefix="/api/courses/{course_id}/announcements", tags=["notices"])


def _require_instructor_of(course_id: str, user_id: str) -> None:
    result = (
        supabase.table("course_instructors")
        .select("id")
        .eq("course_id", course_id)
        .eq("instructor_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="해당 강의의 담당 강사가 아닙니다.")


class AnnouncementGenerateRequest(BaseModel):
    templateType: str   # PREVIEW | REVIEW | GENERAL
    scheduleId: str | None = None
    customMessage: str | None = None


class AnnouncementUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None


def _format_announcement(row: dict) -> dict:
    return {
        "announcementId": row["id"],
        "courseId": row["course_id"],
        "scheduleId": row.get("schedule_id"),
        "status": row["status"],
        "templateType": row["template_type"],
        "title": row.get("title"),
        "content": row.get("content"),
        "customMessage": row.get("custom_message"),
        "createdAt": row["created_at"],
        "completedAt": row.get("completed_at"),
    }


# ── 6.3.1 공지문 자동 생성 트리거 ────────────────────────────────────────────
@router.post("", status_code=201)
def generate_announcement(
    course_id: str,
    payload: AnnouncementGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    valid_types = {"PREVIEW", "REVIEW", "GENERAL"}
    if payload.templateType not in valid_types:
        raise HTTPException(status_code=400, detail=f"templateType은 {valid_types} 중 하나여야 합니다.")

    _require_instructor_of(course_id, current_user["id"])

    result = supabase.table("announcements").insert({
        "course_id": course_id,
        "schedule_id": payload.scheduleId,
        "status": "generating",
        "template_type": payload.templateType,
        "custom_message": payload.customMessage,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="공지문 생성 요청에 실패했습니다.")

    announcement = result.data[0]

    # Phase 4에서 LLM 호출로 교체 예정
    background_tasks.add_task(_placeholder_generate, announcement["id"], payload.templateType, course_id, payload.scheduleId)

    return _format_announcement(announcement)


async def _placeholder_generate(
    announcement_id: str,
    template_type: str,
    course_id: str,
    schedule_id: str | None,
) -> None:
    """Phase 4 AI 공지문 생성 구현 전 placeholder."""
    pass


# ── 공지문 목록 조회 ──────────────────────────────────────────────────────────
@router.get("")
def list_announcements(
    course_id: str,
    template_type: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    q = (
        supabase.table("announcements")
        .select("*")
        .eq("course_id", course_id)
        .order("created_at", desc=True)
    )
    if template_type:
        q = q.eq("template_type", template_type)

    result = q.execute()
    announcements = [_format_announcement(r) for r in (result.data or [])]
    return {"announcements": announcements, "totalCount": len(announcements)}


# ── 공지문 상세 조회 ──────────────────────────────────────────────────────────
@router.get("/{announcement_id}")
def get_announcement(
    course_id: str,
    announcement_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = (
        supabase.table("announcements")
        .select("*")
        .eq("id", announcement_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="공지문을 찾을 수 없습니다.")
    return _format_announcement(result.data)


# ── 공지문 수동 수정 (강사 검토 후) ──────────────────────────────────────────
@router.put("/{announcement_id}")
def update_announcement(
    course_id: str,
    announcement_id: str,
    payload: AnnouncementUpdateRequest,
    current_user: dict = Depends(require_instructor),
):
    _require_instructor_of(course_id, current_user["id"])

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목을 하나 이상 입력하세요.")

    result = (
        supabase.table("announcements")
        .update(updates)
        .eq("id", announcement_id)
        .eq("course_id", course_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="공지문을 찾을 수 없습니다.")
    return _format_announcement(result.data[0])


# ── 공지문 삭제 ───────────────────────────────────────────────────────────────
@router.delete("/{announcement_id}", status_code=204)
def delete_announcement(
    course_id: str,
    announcement_id: str,
    current_user: dict = Depends(require_instructor),
):
    _require_instructor_of(course_id, current_user["id"])
    supabase.table("announcements").delete().eq("id", announcement_id).eq("course_id", course_id).execute()
