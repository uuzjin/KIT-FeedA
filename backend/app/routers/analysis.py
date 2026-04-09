"""4-5. 수업 사후 분석 라우터 (기능명세 6.6).

엔드포인트:
  POST /api/courses/{course_id}/scripts/{script_id}/post-analyses/structure  → 202
  POST /api/courses/{course_id}/scripts/{script_id}/post-analyses/concepts   → 202
  GET  /api/courses/{course_id}/scripts/{script_id}/post-analyses            → 결과 목록
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from ..core.auth import get_current_user, require_instructor
from ..core.background import mark_completed, mark_failed, mark_processing
from ..core.rate_limit import AI_RATE_LIMIT, limiter
from ..database import supabase
from ..dependencies import require_instructor_of

router = APIRouter(
    prefix="/api/courses/{course_id}/scripts/{script_id}/post-analyses",
    tags=["analysis"],
)


def _get_script_text(course_id: str, script_id: str) -> str:
    """스크립트 파일을 Storage에서 내려받아 텍스트 반환."""
    from ..core.storage import BUCKET_SCRIPTS
    from ..core.text_extract import extract_text

    script_row = (
        supabase.table("scripts")
        .select("content_path, mime_type")
        .eq("id", script_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not script_row.data:
        return ""
    try:
        file_bytes: bytes = supabase.storage.from_(BUCKET_SCRIPTS).download(
            script_row.data["content_path"]
        )
        return extract_text(file_bytes, script_row.data["mime_type"])
    except Exception:
        return ""


def _ensure_script_exists(course_id: str, script_id: str) -> None:
    result = (
        supabase.table("scripts")
        .select("id")
        .eq("id", script_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")


# ── POST /structure ───────────────────────────────────────────────────────────

@router.post("/structure", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def trigger_structure_analysis(
    request: Request,
    course_id: str,
    script_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    _ensure_script_exists(course_id, script_id)

    # upsert: 재분석 허용
    supabase.table("script_post_analyses").upsert(
        {"script_id": script_id, "analysis_type": "structure", "status": "pending"},
        on_conflict="script_id,analysis_type",
    ).execute()

    record = (
        supabase.table("script_post_analyses")
        .select("id")
        .eq("script_id", script_id)
        .eq("analysis_type", "structure")
        .maybe_single()
        .execute()
    )
    record_id = record.data["id"] if record.data else None

    background_tasks.add_task(_run_structure, record_id, course_id, script_id)

    return {
        "scriptId": script_id,
        "analysisType": "structure",
        "status": "pending",
        "message": "구조 분석이 시작되었습니다.",
    }


def _run_structure(record_id: str | None, course_id: str, script_id: str) -> None:
    from ..core.ai import call_haiku_json
    from ..prompts.post_analysis import STRUCTURE_SYSTEM, structure_user

    if not record_id:
        return
    mark_processing("script_post_analyses", record_id)
    try:
        from ..core.sanitize import sanitize_prompt_input
        raw_text = _get_script_text(course_id, script_id)
        if not raw_text:
            raise ValueError("스크립트 텍스트를 추출할 수 없습니다.")
        script_text = sanitize_prompt_input(raw_text)
        result = call_haiku_json(STRUCTURE_SYSTEM, structure_user(script_text))
        mark_completed("script_post_analyses", record_id, result)
    except Exception as e:
        mark_failed("script_post_analyses", record_id, str(e))


# ── POST /concepts ────────────────────────────────────────────────────────────

@router.post("/concepts", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def trigger_concepts_analysis(
    request: Request,
    course_id: str,
    script_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    _ensure_script_exists(course_id, script_id)

    supabase.table("script_post_analyses").upsert(
        {"script_id": script_id, "analysis_type": "concepts", "status": "pending"},
        on_conflict="script_id,analysis_type",
    ).execute()

    record = (
        supabase.table("script_post_analyses")
        .select("id")
        .eq("script_id", script_id)
        .eq("analysis_type", "concepts")
        .maybe_single()
        .execute()
    )
    record_id = record.data["id"] if record.data else None

    background_tasks.add_task(_run_concepts, record_id, course_id, script_id)

    return {
        "scriptId": script_id,
        "analysisType": "concepts",
        "status": "pending",
        "message": "개념어 체크가 시작되었습니다.",
    }


def _run_concepts(record_id: str | None, course_id: str, script_id: str) -> None:
    from ..core.ai import call_haiku_json
    from ..prompts.post_analysis import CONCEPTS_SYSTEM, concepts_user

    if not record_id:
        return
    mark_processing("script_post_analyses", record_id)
    try:
        from ..core.sanitize import sanitize_prompt_input
        raw_text = _get_script_text(course_id, script_id)
        if not raw_text:
            raise ValueError("스크립트 텍스트를 추출할 수 없습니다.")
        script_text = sanitize_prompt_input(raw_text)
        result = call_haiku_json(CONCEPTS_SYSTEM, concepts_user(script_text))
        mark_completed("script_post_analyses", record_id, result)
    except Exception as e:
        mark_failed("script_post_analyses", record_id, str(e))


# ── GET / (결과 조회) ─────────────────────────────────────────────────────────

@router.get("")
def get_post_analyses(
    course_id: str,
    script_id: str,
    current_user: dict = Depends(get_current_user),
):
    _ensure_script_exists(course_id, script_id)

    rows = (
        supabase.table("script_post_analyses")
        .select("id, analysis_type, status, result, error_message, started_at, completed_at")
        .eq("script_id", script_id)
        .execute()
    )
    return {
        "scriptId": script_id,
        "postAnalyses": rows.data or [],
    }
