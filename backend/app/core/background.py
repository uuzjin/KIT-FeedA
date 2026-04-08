"""비동기 AI 작업 공통 패턴.

사용법:
    async def _run_analysis(script_id: str):
        mark_processing("script_analyses", record_id)
        try:
            result = await ai_client.analyze(...)
            mark_completed("script_analyses", record_id, {"key": result})
        except Exception as e:
            mark_failed("script_analyses", record_id, str(e))

    background_tasks.add_task(_run_analysis, script_id)
"""
from datetime import datetime, timezone

from ..database import supabase


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def mark_processing(table: str, record_id: str) -> None:
    supabase.table(table).update({"status": "processing", "started_at": _now()}).eq("id", record_id).execute()


def mark_completed(table: str, record_id: str, result: dict) -> None:
    supabase.table(table).update(
        {"status": "completed", "result": result, "completed_at": _now()}
    ).eq("id", record_id).execute()


def mark_failed(table: str, record_id: str, error: str) -> None:
    supabase.table(table).update(
        {"status": "failed", "error_message": error, "completed_at": _now()}
    ).eq("id", record_id).execute()


def mark_status(table: str, record_id: str, status: str, extra: dict | None = None) -> None:
    """status 컬럼이 있는 임의 테이블 상태 업데이트."""
    updates: dict = {"status": status}
    if extra:
        updates.update(extra)
    supabase.table(table).update(updates).eq("id", record_id).execute()
