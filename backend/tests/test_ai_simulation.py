"""3-C. AI 시뮬레이션 파이프라인 상태 전이 테스트.

커버리지:
  - _run_assessment_generation : pending → processing → completed / failed
  - _run_answer_generation     : pending → processing → completed / failed
  - _run_grading               : pending → processing → completed / failed
"""
from unittest.mock import MagicMock, patch


# ─────────────────────────────────────────────────────────────────────────────
# 공통 헬퍼
# ─────────────────────────────────────────────────────────────────────────────

def _make_sb_for_assessment(questions=None):
    """assessment + context 조회를 지원하는 Supabase 목."""
    mock_sb = MagicMock()

    # ai_sim_contexts 조회 (maybe_single)
    context_row = MagicMock()
    context_row.data = {"id": "ctx-001", "script_ids": ["script-001"]}

    # scripts 조회
    script_row = MagicMock()
    script_row.data = {"id": "script-001", "content_path": "path/file.pdf", "mime_type": "application/pdf", "title": "테스트"}

    # 체인 구성: table → select → eq → maybe_single → execute
    def table_dispatch(name):
        t = MagicMock()
        sel = MagicMock()
        sel.eq.return_value.maybe_single.return_value.execute.return_value = (
            context_row if "context" in name else script_row
        )
        sel.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = script_row
        sel.eq.return_value.in_.return_value.execute.return_value = MagicMock(data=[{"id": "script-001"}])
        sel.eq.return_value.execute.return_value = MagicMock(data=[])
        t.select.return_value = sel
        t.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        return t

    mock_sb.table.side_effect = table_dispatch
    mock_sb.storage.from_.return_value.download.return_value = b"fake pdf content"
    return mock_sb


# ─────────────────────────────────────────────────────────────────────────────
# 5-2. _run_assessment_generation 상태 전이
# ─────────────────────────────────────────────────────────────────────────────

def test_assessment_generation_completed():
    """AI 호출 성공 → ai_sim_assessments status=completed 로 업데이트."""
    updated_status: list[str] = []

    # supabase.table(...).update({...}).eq(...).execute() 체인을 단일 mock으로 처리
    mock_sb = MagicMock()

    def capture_update(payload: dict):
        updated_status.append(payload.get("status", "?"))
        chain = MagicMock()
        chain.eq.return_value.execute.return_value = MagicMock(data=[])
        return chain

    mock_sb.table.return_value.update.side_effect = capture_update

    fake_questions = [{"id": "q1", "type": "CONCEPT", "content": "질문1"}]

    with (
        patch("app.routers.ai_simulation.supabase", mock_sb),
        patch("app.routers.ai_simulation.mark_processing", MagicMock()),
        patch("app.routers.ai_simulation.mark_failed", MagicMock()),
        # _get_context_text를 직접 패치해서 DB/Storage 체인 우회
        patch("app.routers.ai_simulation._get_context_text", return_value="스크립트 내용"),
        patch("app.core.ai.call_sonnet_json", return_value={"questions": fake_questions}),
    ):
        from app.routers.ai_simulation import _run_assessment_generation
        _run_assessment_generation(
            "assess-001", "course-001", "ctx-001",
            ["CONCEPT", "APPLICATION"], 5,
        )

    assert "completed" in updated_status, f"completed 전이 없음: {updated_status}"


def test_assessment_generation_failed_on_empty_script():
    """빈 스크립트 텍스트 → mark_failed 호출."""
    failed_ids: list[str] = []

    with (
        patch("app.routers.ai_simulation.mark_processing", MagicMock()),
        patch("app.routers.ai_simulation.mark_failed",
              lambda table, rid, msg: failed_ids.append(rid)),
        patch("app.routers.ai_simulation._get_context_text", return_value=""),
    ):
        from app.routers.ai_simulation import _run_assessment_generation
        _run_assessment_generation(
            "assess-fail", "course-001", "ctx-001", ["CONCEPT"], 3,
        )

    assert "assess-fail" in failed_ids, "빈 스크립트에 failed 전이 없음"


def test_assessment_generation_failed_on_ai_error():
    """AI 호출 예외 → mark_failed 호출."""
    failed_ids: list[str] = []

    with (
        patch("app.routers.ai_simulation.mark_processing", MagicMock()),
        patch("app.routers.ai_simulation.mark_failed",
              lambda table, rid, msg: failed_ids.append(rid)),
        patch("app.routers.ai_simulation._get_context_text", return_value="스크립트"),
        patch("app.core.ai.call_sonnet_json", side_effect=RuntimeError("AI 오류")),
    ):
        from app.routers.ai_simulation import _run_assessment_generation
        _run_assessment_generation(
            "assess-ai-err", "course-001", "ctx-001", ["CONCEPT"], 3,
        )

    assert "assess-ai-err" in failed_ids, "AI 오류에 failed 전이 없음"


# ─────────────────────────────────────────────────────────────────────────────
# 5-3. _run_answer_generation 상태 전이
# ─────────────────────────────────────────────────────────────────────────────

def test_answer_generation_completed():
    """문항 있음 + 스크립트 있음 → ai_sim_answers status=completed."""
    updated_status: list[str] = []

    def capture_update(payload: dict):
        updated_status.append(payload.get("status", "?"))
        chain = MagicMock()
        chain.eq.return_value.execute.return_value = MagicMock(data=[])
        return chain

    mock_sb = MagicMock()
    # ai_sim_assessments 조회 (questions 반환)
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(
        data={"questions": [{"id": "q1", "content": "질문"}]}
    )
    mock_sb.table.return_value.update.side_effect = capture_update

    with (
        patch("app.routers.ai_simulation.supabase", mock_sb),
        patch("app.routers.ai_simulation.mark_processing", MagicMock()),
        patch("app.routers.ai_simulation.mark_failed", MagicMock()),
        patch("app.routers.ai_simulation._get_context_text", return_value="스크립트"),
        patch("app.core.ai.call_haiku_json",
              return_value={"answers": [{"questionId": "q1", "answer": "답변1"}]}),
    ):
        from app.routers.ai_simulation import _run_answer_generation
        _run_answer_generation("ans-001", "assess-001", "course-001", "ctx-001")

    assert "completed" in updated_status, f"completed 전이 없음: {updated_status}"


def test_answer_generation_failed_on_empty_questions():
    """문항 없음 → mark_failed 호출."""
    failed_ids: list[str] = []

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(data={"questions": []})

    with (
        patch("app.routers.ai_simulation.supabase", mock_sb),
        patch("app.routers.ai_simulation.mark_processing", MagicMock()),
        patch("app.routers.ai_simulation.mark_failed",
              lambda table, rid, msg: failed_ids.append(rid)),
        patch("app.routers.ai_simulation._get_context_text", return_value="스크립트"),
    ):
        from app.routers.ai_simulation import _run_answer_generation
        _run_answer_generation("ans-fail", "assess-001", "course-001", "ctx-001")

    assert "ans-fail" in failed_ids, "빈 문항에 failed 전이 없음"


# ─────────────────────────────────────────────────────────────────────────────
# 5-4. _run_grading 상태 전이
# ─────────────────────────────────────────────────────────────────────────────

def test_grading_completed():
    """문항 + 답변 있음 → ai_sim_grades status=completed."""
    updated_status: list[str] = []

    def capture_update(payload: dict):
        updated_status.append(payload.get("status", "?"))
        chain = MagicMock()
        chain.eq.return_value.execute.return_value = MagicMock(data=[])
        return chain

    mock_sb = MagicMock()

    call_count = 0
    def maybe_single_execute():
        nonlocal call_count
        call_count += 1
        # 첫 번째: 문항 조회, 두 번째: 답변 조회
        if call_count == 1:
            return MagicMock(data={"questions": [{"id": "q1", "content": "질문"}]})
        return MagicMock(data={"answers": [{"questionId": "q1", "answer": "답변"}]})

    mock_sb.table.return_value.select.return_value.eq.return_value\
        .maybe_single.return_value.execute.side_effect = lambda: maybe_single_execute()
    mock_sb.table.return_value.update.side_effect = capture_update

    fake_result = {
        "total_score": 85.0,
        "grades": [{"questionId": "q1", "score": 85}],
        "strengths": ["개념 이해"],
        "weaknesses": [],
    }

    with (
        patch("app.routers.ai_simulation.supabase", mock_sb),
        patch("app.routers.ai_simulation.mark_processing", MagicMock()),
        patch("app.routers.ai_simulation.mark_failed", MagicMock()),
        patch("app.core.ai.call_sonnet_json", return_value=fake_result),
    ):
        from app.routers.ai_simulation import _run_grading
        _run_grading("grade-001", "assess-001")

    assert "completed" in updated_status, f"completed 전이 없음: {updated_status}"


def test_grading_failed_on_missing_data():
    """문항 또는 답변 없음 → mark_failed 호출."""
    failed_ids: list[str] = []

    mock_sb = MagicMock()
    # 두 조회 모두 빈 결과
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(data={})

    with (
        patch("app.routers.ai_simulation.supabase", mock_sb),
        patch("app.routers.ai_simulation.mark_processing", MagicMock()),
        patch("app.routers.ai_simulation.mark_failed",
              lambda table, rid, msg: failed_ids.append(rid)),
    ):
        from app.routers.ai_simulation import _run_grading
        _run_grading("grade-fail", "assess-001")

    assert "grade-fail" in failed_ids, "빈 데이터에 failed 전이 없음"
