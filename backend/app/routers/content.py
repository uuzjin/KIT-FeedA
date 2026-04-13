"""4-2 / 4-3b. 예습 가이드 & 복습 요약본 라우터.

엔드포인트:
  POST /api/courses/{course_id}/schedules/{schedule_id}/preview-guides   → 202
  GET  /api/courses/{course_id}/schedules/{schedule_id}/preview-guides
  POST /api/courses/{course_id}/schedules/{schedule_id}/review-summaries → 202
  GET  /api/courses/{course_id}/schedules/{schedule_id}/review-summaries
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from ..core.auth import get_current_user, require_instructor
from ..core.background import mark_failed
from ..core.rate_limit import AI_RATE_LIMIT, limiter
from ..database import supabase
from ..dependencies import require_instructor_of

materials_router = APIRouter(
    tags=["content"],
)

# 두 리소스의 URL 계층이 다르므로 별도 router 객체 사용
preview_router = APIRouter(
    tags=["content"],
)
review_router = APIRouter(
    tags=["content"],
)


# ── 공통 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_schedule(course_id: str, schedule_id: str) -> dict:
    result = (
        supabase.table("course_schedules")
        .select("id, week_number, topic")
        .eq("id", schedule_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다.")
    return result.data


def _get_script_text(course_id: str, schedule_id: str) -> str:
    """해당 스케줄의 최신 스크립트 텍스트 반환. 없으면 해당 과목의 최신 스크립트라도 활용."""
    from ..core.storage import BUCKET_SCRIPTS
    from ..core.text_extract import extract_text

    # 1. 우선 해당 스케줄(주차)에 연결된 자료 확인
    row = (
        supabase.table("scripts")
        .select("content_path, mime_type")
        .eq("course_id", course_id)
        .eq("schedule_id", schedule_id)
        .order("uploaded_at", desc=True)
        .limit(1)
        .execute()
    )
    
    # 2. 없다면 주차 미지정 자료 중 가장 최근 것 확인
    if not row.data:
        row = (
            supabase.table("scripts")
            .select("content_path, mime_type")
            .eq("course_id", course_id)
            .is_("schedule_id", "null")
            .order("uploaded_at", desc=True)
            .limit(1)
            .execute()
        )

    if not row.data:
        raise ValueError("분석할 강의 자료(PDF 등)가 없습니다. 먼저 자료를 업로드해주세요.")

    try:
        file_bytes: bytes = supabase.storage.from_(BUCKET_SCRIPTS).download(
            row.data[0]["content_path"]
        )
        text = extract_text(file_bytes, row.data[0]["mime_type"])
        if not text or len(text.strip()) < 10:
            raise ValueError("강의 자료에서 텍스트를 추출할 수 없습니다. 파일 내용을 확인해주세요.")
        return text
    except Exception as e:
        raise ValueError(f"강의 자료 다운로드 또는 텍스트 추출 중 오류 발생: {str(e)}")


def _get_transcript_text(course_id: str, schedule_id: str) -> str:
    """해당 스케줄의 최신 완료된 오디오 변환 텍스트 반환. 없으면 빈 문자열."""
    audio = (
        supabase.table("audios")
        .select("id")
        .eq("course_id", course_id)
        .eq("schedule_id", schedule_id)
        .eq("status", "COMPLETED")
        .order("uploaded_at", desc=True)
        .limit(1)
        .execute()
    )
    if not audio.data:
        return ""

    transcript = (
        supabase.table("audio_transcripts")
        .select("transcript")
        .eq("audio_id", audio.data[0]["id"])
        .maybe_single()
        .execute()
    )
    return transcript.data["transcript"] if transcript.data else ""


# ═════════════════════════════════════════════════════════════════════════════
# 4-2. 예습 가이드
# ═════════════════════════════════════════════════════════════════════════════

def _format_preview_guide(row: dict) -> dict:
    week = row.get("course_schedules", {}).get("week_number") if isinstance(row.get("course_schedules"), dict) else None
    title = row.get("title") or (f"{week}주차 예습 가이드" if week else "예습 가이드")
    return {
        "previewGuideId": row["id"],
        "courseId": row["course_id"],
        "scheduleId": row["schedule_id"],
        "title": title,
        "status": row["status"],
        "keyConcepts": row.get("key_concepts") or [],
        "readingMaterials": row.get("reading_materials"),
        "summary": row.get("summary"),
        "createdAt": row["created_at"],
        "completedAt": row.get("completed_at"),
    }


def _format_material(row: dict, material_type: str) -> dict:
    schedule = row.get("course_schedules") if isinstance(row.get("course_schedules"), dict) else {}
    week_number = schedule.get("week_number")
    topic = schedule.get("topic")
    if material_type == "PREVIEW_GUIDE":
        fallback_title = f"{week_number}주차 예습 가이드" if week_number else "예습 가이드"
    else:
        fallback_title = f"{week_number}주차 복습 요약" if week_number else "복습 요약"

    return {
        "materialId": row["id"],
        "courseId": row["course_id"],
        "scheduleId": row.get("schedule_id"),
        "type": material_type,
        "title": row.get("title") or fallback_title,
        "content": row.get("content") or row.get("summary"),
        "createdAt": row["created_at"],
        "updatedAt": row.get("completed_at") or row.get("created_at"),
        "weekNumber": week_number,
        "topic": topic,
        "status": row.get("status"),
    }


@materials_router.get("")
def list_course_materials(
    course_id: str,
    type: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    if type not in {None, "PREVIEW_GUIDE", "REVIEW_SUMMARY"}:
        raise HTTPException(status_code=400, detail="지원하지 않는 자료 타입입니다.")

    materials: list[dict] = []

    if type in (None, "PREVIEW_GUIDE"):
        previews = (
            supabase.table("preview_guides")
            .select("id, course_id, schedule_id, title, summary, status, created_at, completed_at, course_schedules(week_number, topic)")
            .eq("course_id", course_id)
            .execute()
        )
        materials.extend(_format_material(row, "PREVIEW_GUIDE") for row in (previews.data or []))

    if type in (None, "REVIEW_SUMMARY"):
        reviews = (
            supabase.table("review_summaries")
            .select("id, course_id, schedule_id, title, content, status, created_at, completed_at, course_schedules(week_number, topic)")
            .eq("course_id", course_id)
            .execute()
        )
        materials.extend(_format_material(row, "REVIEW_SUMMARY") for row in (reviews.data or []))

    materials.sort(key=lambda row: row.get("createdAt") or "", reverse=True)
    return {"materials": materials, "totalCount": len(materials)}


@preview_router.post("", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def generate_preview_guide(
    request: Request,
    course_id: str,
    schedule_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    schedule = _get_schedule(course_id, schedule_id)

    # 스케줄당 1개 — 이미 있으면 409
    existing = (
        supabase.table("preview_guides")
        .select("id, status")
        .eq("schedule_id", schedule_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="해당 스케줄의 예습 가이드가 이미 존재합니다. 재생성하려면 기존 항목을 삭제하세요.",
        )

    result = supabase.table("preview_guides").insert({
        "course_id": course_id,
        "schedule_id": schedule_id,
        "status": "generating",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="예습 가이드 생성 요청에 실패했습니다.")

    guide = result.data[0]
    background_tasks.add_task(
        _run_preview_guide,
        guide["id"],
        course_id,
        schedule_id,
        schedule.get("topic") or "강의",
        schedule.get("week_number"),
    )

    return {
        "previewGuideId": guide["id"],
        "scheduleId": schedule_id,
        "status": "generating",
        "message": "예습 가이드 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


def _run_preview_guide(
    guide_id: str,
    course_id: str,
    schedule_id: str,
    topic: str,
    week_number: int | None,
) -> None:
    from datetime import datetime, timezone

    from ..core.ai import call_sonnet_json
    from ..prompts.content_generation import PREVIEW_GUIDE_SYSTEM, preview_guide_user

    try:
        from ..core.sanitize import sanitize_prompt_input
        script_text = sanitize_prompt_input(_get_script_text(course_id, schedule_id))
        result = call_sonnet_json(
            PREVIEW_GUIDE_SYSTEM,
            preview_guide_user(topic, week_number, script_text),
        )

        title = f"{week_number}주차 예습 가이드" if week_number else "예습 가이드"
        supabase.table("preview_guides").update({
            "status": "completed",
            "title": title,
            "key_concepts": result.get("key_concepts", []),
            "reading_materials": result.get("reading_materials", []),
            "summary": result.get("summary"),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", guide_id).execute()

    except Exception as e:
        supabase.table("preview_guides").update({
            "status": "failed",
            "error_message": str(e),
        }).eq("id", guide_id).execute()


@preview_router.get("")
def get_preview_guide(
    course_id: str,
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
):
    _get_schedule(course_id, schedule_id)  # 404 guard

    result = (
        supabase.table("preview_guides")
        .select("*")
        .eq("schedule_id", schedule_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="예습 가이드가 아직 생성되지 않았습니다.")

    row = result.data
    # week_number를 schedule에서 직접 보강
    schedule = (
        supabase.table("course_schedules")
        .select("week_number")
        .eq("id", schedule_id)
        .maybe_single()
        .execute()
    )
    week_number = schedule.data["week_number"] if schedule.data else None
    title = row.get("title") or (f"{week_number}주차 예습 가이드" if week_number else "예습 가이드")

    return {
        "previewGuideId": row["id"],
        "courseId": row["course_id"],
        "scheduleId": row["schedule_id"],
        "title": title,
        "status": row["status"],
        "keyConcepts": row.get("key_concepts") or [],
        "readingMaterials": row.get("reading_materials"),
        "summary": row.get("summary"),
        "errorMessage": row.get("error_message"),
        "createdAt": row["created_at"],
        "completedAt": row.get("completed_at"),
    }


# ═════════════════════════════════════════════════════════════════════════════
# 4-3b. 복습 요약본
# ═════════════════════════════════════════════════════════════════════════════

@review_router.post("", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def generate_review_summary(
    request: Request,
    course_id: str,
    schedule_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    schedule = _get_schedule(course_id, schedule_id)

    # 스케줄당 1개 — 이미 있으면 409
    existing = (
        supabase.table("review_summaries")
        .select("id, status")
        .eq("schedule_id", schedule_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="해당 스케줄의 복습 요약본이 이미 존재합니다. 재생성하려면 기존 항목을 삭제하세요.",
        )

    result = supabase.table("review_summaries").insert({
        "course_id": course_id,
        "schedule_id": schedule_id,
        "status": "generating",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="복습 요약본 생성 요청에 실패했습니다.")

    summary = result.data[0]
    background_tasks.add_task(
        _run_review_summary,
        summary["id"],
        course_id,
        schedule_id,
        schedule.get("topic") or "강의",
        schedule.get("week_number"),
    )

    return {
        "reviewSummaryId": summary["id"],
        "scheduleId": schedule_id,
        "status": "generating",
        "message": "복습 요약본 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


def _run_review_summary(
    summary_id: str,
    course_id: str,
    schedule_id: str,
    topic: str,
    week_number: int | None,
) -> None:
    from datetime import datetime, timezone

    from ..core.ai import call_sonnet_json
    from ..prompts.content_generation import REVIEW_SUMMARY_SYSTEM, review_summary_user

    try:
        from ..core.sanitize import sanitize_prompt_input
        script_text = sanitize_prompt_input(_get_script_text(course_id, schedule_id))
        transcript_text = sanitize_prompt_input(_get_transcript_text(course_id, schedule_id))

        result = call_sonnet_json(
            REVIEW_SUMMARY_SYSTEM,
            review_summary_user(topic, week_number, script_text, transcript_text),
        )

        title = f"{week_number}주차 복습 요약본" if week_number else "복습 요약본"
        supabase.table("review_summaries").update({
            "status": "completed",
            "title": title,
            "content": result.get("content"),
            "key_points": result.get("key_points", []),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", summary_id).execute()

    except Exception as e:
        supabase.table("review_summaries").update({
            "status": "failed",
            "error_message": str(e),
        }).eq("id", summary_id).execute()


@review_router.get("")
def get_review_summary(
    course_id: str,
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
):
    _get_schedule(course_id, schedule_id)  # 404 guard

    result = (
        supabase.table("review_summaries")
        .select("*")
        .eq("schedule_id", schedule_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="복습 요약본이 아직 생성되지 않았습니다.")

    row = result.data
    schedule = (
        supabase.table("course_schedules")
        .select("week_number")
        .eq("id", schedule_id)
        .maybe_single()
        .execute()
    )
    week_number = schedule.data["week_number"] if schedule.data else None
    title = row.get("title") or (f"{week_number}주차 복습 요약본" if week_number else "복습 요약본")

    return {
        "reviewSummaryId": row["id"],
        "courseId": row["course_id"],
        "scheduleId": row["schedule_id"],
        "title": title,
        "status": row["status"],
        "content": row.get("content"),
        "keyPoints": row.get("key_points") or [],
        "errorMessage": row.get("error_message"),
        "createdAt": row["created_at"],
        "completedAt": row.get("completed_at"),
    }
