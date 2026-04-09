"""7-1. 비동기 상태 전이 테스트.

POST 202 → pending DB 레코드 생성 → background task 실행 → completed/failed 전이
를 AI mock 없이 검증한다.
"""
from unittest.mock import MagicMock, call, patch

import pytest


# ── 헬퍼 ──────────────────────────────────────────────────────────────────────

def _mock_sb_chain():
    """체인형 Supabase 목 반환."""
    mock = MagicMock()
    ok = MagicMock()
    ok.data = [{"id": "rec-001", "status": "pending"}]
    mock.table.return_value.insert.return_value.execute.return_value = ok
    mock.table.return_value.upsert.return_value.execute.return_value = ok
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(data={"id": "rec-001", "status": "pending"})
    mock.table.return_value.select.return_value.eq.return_value.maybe_single\
        .return_value.execute.return_value = MagicMock(data={"id": "rec-001"})
    return mock


# ── script_analyses 상태 전이 ────────────────────────────────────────────────

def test_script_analysis_status_transition():
    """스크립트 업로드 시 pending → processing → completed 전이.

    _run_suggestions는 별도 테스트이므로 no-op으로 패치한다.
    """
    calls: list[str] = []

    def fake_mark_processing(table, record_id):
        calls.append(f"processing:{record_id}")

    def fake_mark_completed(table, record_id, result):
        calls.append(f"completed:{record_id}")

    mock_sb = MagicMock()
    # script_analyses 레코드 목킹
    analyses_result = MagicMock()
    analyses_result.data = [
        {"id": "a-logic", "analysis_type": "logic"},
        {"id": "a-term", "analysis_type": "terminology"},
        {"id": "a-prereq", "analysis_type": "prerequisites"},
    ]
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .execute.return_value = analyses_result
    mock_sb.storage.from_.return_value.download.return_value = b"fake pdf content"

    with (
        patch("app.routers.scripts.supabase", mock_sb),
        patch("app.routers.scripts.mark_processing", fake_mark_processing),
        patch("app.routers.scripts.mark_completed", fake_mark_completed),
        patch("app.routers.scripts.mark_failed", MagicMock()),
        patch("app.routers.scripts._run_suggestions", MagicMock()),   # 2단계 no-op
        patch("app.core.ai.call_haiku_json", return_value={"ok": True}),
        patch("app.core.text_extract.extract_text", return_value="스크립트 내용"),
    ):
        from app.routers.scripts import _run_structural_analysis
        _run_structural_analysis("script-001", "course/script.pdf", "application/pdf")

    assert any("processing" in c for c in calls), "processing 상태 전이가 없습니다."
    assert any("completed" in c for c in calls), "completed 상태 전이가 없습니다."


# ── preview_guides 상태 전이 ─────────────────────────────────────────────────

def test_preview_guide_status_transition():
    """예습 가이드 생성: generating → completed."""
    mock_sb = MagicMock()
    updated: list[str] = []

    def capture_update(updates):
        updated.append(updates.get("status", "?"))
        return mock_sb.table.return_value.update.return_value

    mock_sb.table.return_value.update.side_effect = lambda u: capture_update(u)
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    fake_result = {"key_concepts": ["개념A"], "reading_materials": [], "summary": "요약"}

    with (
        patch("app.routers.content.supabase", mock_sb),
        patch("app.core.ai.call_sonnet_json", return_value=fake_result),
        patch("app.routers.content._get_script_text", return_value="스크립트 텍스트"),
    ):
        from app.routers.content import _run_preview_guide
        _run_preview_guide("guide-001", "course-001", "sched-001", "운영체제", 3)

    assert "completed" in updated, f"completed 전이 없음, 실제 상태들: {updated}"


def test_preview_guide_status_failed_on_ai_error():
    """AI 호출 실패 시 failed 상태로 전이해야 한다."""
    mock_sb = MagicMock()
    updated: list[str] = []

    def capture_update(updates):
        updated.append(updates.get("status", "?"))
        return mock_sb.table.return_value.update.return_value

    mock_sb.table.return_value.update.side_effect = lambda u: capture_update(u)
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    with (
        patch("app.routers.content.supabase", mock_sb),
        patch("app.core.ai.call_sonnet_json", side_effect=RuntimeError("AI 오류")),
        patch("app.routers.content._get_script_text", return_value="텍스트"),
    ):
        from app.routers.content import _run_preview_guide
        _run_preview_guide("guide-001", "course-001", "sched-001", "운영체제", 3)

    assert "failed" in updated, f"failed 전이 없음, 실제 상태들: {updated}"


# ── review_summaries 상태 전이 ────────────────────────────────────────────────

def test_review_summary_status_transition():
    """복습 요약본 생성: generating → completed."""
    mock_sb = MagicMock()
    updated: list[str] = []

    def capture_update(updates):
        updated.append(updates.get("status", "?"))
        return mock_sb.table.return_value.update.return_value

    mock_sb.table.return_value.update.side_effect = lambda u: capture_update(u)
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    fake_result = {"content": "복습 내용", "key_points": ["포인트1"]}

    with (
        patch("app.routers.content.supabase", mock_sb),
        patch("app.core.ai.call_sonnet_json", return_value=fake_result),
        patch("app.routers.content._get_script_text", return_value="스크립트"),
        patch("app.routers.content._get_transcript_text", return_value="오디오 텍스트"),
    ):
        from app.routers.content import _run_review_summary
        _run_review_summary("sum-001", "course-001", "sched-001", "운영체제", 3)

    assert "completed" in updated, f"completed 전이 없음, 실제 상태들: {updated}"


# ── script_post_analyses 상태 전이 ───────────────────────────────────────────

def test_post_analysis_structure_transition():
    """사후 구조 분석: pending → processing → completed."""
    from app.core.background import mark_completed, mark_failed, mark_processing

    processed: list[str] = []
    completed_: list[str] = []

    def fake_mark_processing(table, record_id):
        processed.append(record_id)

    def fake_mark_completed(table, record_id, result):
        completed_.append(record_id)

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(
        data={"id": "script-001", "content_path": "path/file.pdf", "mime_type": "application/pdf"}
    )

    fake_ai_result = {"flow": "good"}
    with (
        patch("app.routers.analysis.supabase", mock_sb),
        patch("app.routers.analysis.mark_processing", fake_mark_processing),
        patch("app.routers.analysis.mark_completed", fake_mark_completed),
        patch("app.routers.analysis.mark_failed", MagicMock()),
        patch("app.core.ai.call_haiku_json", return_value=fake_ai_result),
        patch("app.routers.analysis._get_script_text", return_value="스크립트 내용"),
    ):
        from app.routers.analysis import _run_structure
        _run_structure("rec-001", "course-001", "script-001")

    assert "rec-001" in processed, "processing 전이 없음"
    assert "rec-001" in completed_, "completed 전이 없음"


def test_post_analysis_fails_on_empty_text():
    """스크립트 텍스트가 비어 있으면 failed로 전이해야 한다."""
    failed_: list[str] = []

    def fake_mark_failed(table, record_id, msg):
        failed_.append(record_id)

    with (
        patch("app.routers.analysis.mark_processing", MagicMock()),
        patch("app.routers.analysis.mark_completed", MagicMock()),
        patch("app.routers.analysis.mark_failed", fake_mark_failed),
        patch("app.routers.analysis._get_script_text", return_value=""),
    ):
        from app.routers.analysis import _run_structure
        _run_structure("rec-fail", "course-001", "script-001")

    assert "rec-fail" in failed_, "빈 텍스트에 failed 전이 없음"
