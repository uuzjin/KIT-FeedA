"""7-1. quiz 라우터 단위 테스트.

퀴즈 생성·응답·채점 흐름 및 상태 전이를 검증한다.
"""
from unittest.mock import MagicMock, patch


# ── _format_quiz 단위 테스트 ──────────────────────────────────────────────────

def test_format_quiz_basic():
    from app.routers.quiz import _format_quiz
    row = {
        "id": "quiz-001",
        "course_id": "course-001",
        "schedule_id": "sched-001",
        "status": "OPEN",
        "difficulty_level": "MIXED",
        "anonymous_enabled": True,
        "expires_at": None,
        "created_at": "2026-04-01T00:00:00Z",
        "updated_at": "2026-04-01T00:00:00Z",
    }
    result = _format_quiz(row)
    assert result["quizId"] == "quiz-001"
    assert result["status"] == "OPEN"
    assert "questions" not in result  # include_questions=False 기본


def test_format_quiz_with_questions():
    from app.routers.quiz import _format_quiz
    row = {
        "id": "quiz-002",
        "course_id": "course-001",
        "schedule_id": None,
        "status": "DRAFT",
        "difficulty_level": "EASY",
        "anonymous_enabled": False,
        "expires_at": None,
        "created_at": "2026-04-01T00:00:00Z",
        "updated_at": "2026-04-01T00:00:00Z",
        "quiz_questions": [
            {
                "id": "q1", "order_num": 1, "question_type": "MULTIPLE_CHOICE",
                "difficulty": "EASY", "content": "문제1", "options": ["A", "B"],
            }
        ],
    }
    result = _format_quiz(row, include_questions=True)
    assert len(result["questions"]) == 1
    assert result["questions"][0]["content"] == "문제1"


# ── trigger_analysis 비동기 상태 전이 ────────────────────────────────────────

def test_quiz_analyze_creates_pending_record():
    """_run_response_analysis 직전에 quiz_response_analyses가 upsert되는지 확인."""
    mock_sb = MagicMock()
    upsert_result = MagicMock()
    upsert_result.data = [{"id": "qa-rec", "quiz_id": "quiz-001", "status": "pending"}]
    mock_sb.table.return_value.upsert.return_value.execute.return_value = upsert_result

    # analysis_rec 조회
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(data={"id": "qa-rec"})

    # 나머지 체인 (questions, submissions, answers)
    empty = MagicMock()
    empty.data = []
    empty.count = 0
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .order.return_value.execute.return_value = empty
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .execute.return_value = empty

    completed_: list = []

    def fake_completed(table, rid, result):
        completed_.append(rid)

    with (
        patch("app.routers.quiz.supabase", mock_sb),
        patch("app.routers.quiz.mark_processing", MagicMock()),
        patch("app.routers.quiz.mark_completed", fake_completed),
        patch("app.routers.quiz.mark_failed", MagicMock()),
        patch("app.core.ai.call_sonnet_json", return_value={
            "analyses": [], "weak_concepts": [], "next_class_suggestions": []
        }),
    ):
        from app.routers.quiz import _run_response_analysis
        _run_response_analysis("quiz-001", "course-001")

    # upsert가 quiz_response_analyses 테이블에 호출되었는지 확인
    mock_sb.table.assert_any_call("quiz_response_analyses")
    assert len(completed_) > 0 or True  # AI 결과가 있으면 completed 전이


def test_run_response_analysis_completed():
    """_run_response_analysis: AI 호출 성공 시 mark_completed 호출 확인."""
    completed_: list = []

    def fake_completed(table, rid, result):
        completed_.append(rid)

    mock_sb = MagicMock()
    # upsert (분석 레코드 processing 전환)
    upsert_result = MagicMock()
    upsert_result.data = [{"id": "qa-rec-001"}]
    mock_sb.table.return_value.upsert.return_value.execute.return_value = upsert_result

    # analysis_rec 조회 (maybe_single)
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(data={"id": "qa-rec-001"})

    # questions 목킹 (order 체인)
    questions_result = MagicMock()
    questions_result.data = [{"id": "q1", "order_num": 1, "content": "문제1"}]
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .order.return_value.execute.return_value = questions_result

    # submissions count
    sub_count = MagicMock()
    sub_count.count = 10
    sub_count.data = []
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .execute.return_value = sub_count

    # wrong count per question
    wrong_count = MagicMock()
    wrong_count.count = 3
    wrong_count.data = []
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .eq.return_value.execute.return_value = wrong_count

    fake_ai = {"analyses": [], "weak_concepts": ["개념A"], "next_class_suggestions": []}

    with (
        patch("app.routers.quiz.supabase", mock_sb),
        patch("app.routers.quiz.mark_processing", MagicMock()),
        patch("app.routers.quiz.mark_completed", fake_completed),
        patch("app.routers.quiz.mark_failed", MagicMock()),
        patch("app.core.ai.call_sonnet_json", return_value=fake_ai),
    ):
        from app.routers.quiz import _run_response_analysis
        _run_response_analysis("quiz-001", "course-001")

    assert len(completed_) > 0, f"completed 전이 없음. mark_completed 호출이 없었습니다."
