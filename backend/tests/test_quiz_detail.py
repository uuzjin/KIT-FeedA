import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import get_current_user

client = TestClient(app)

def test_get_my_submission_success():
    """학생 본인의 퀴즈 제출 상세 내역 조회 성공 케이스"""
    mock_sb = MagicMock()
    
    # Auth Mock
    mock_user = {"id": "student-abc", "role": "STUDENT", "email": "student@example.com"}
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # 1. 제출 내역 (quiz_submissions)
    mock_sub = MagicMock()
    mock_sub.data = {
        "id": "sub-123",
        "quiz_id": "quiz-001",
        "student_id": "student-abc",
        "score": 85.0,
        "correct_count": 2,
        "total_count": 3,
        "submitted_at": "2026-04-13T10:00:00Z"
    }
    mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_sub

    # 2. 퀴즈 및 문항 (quizzes)
    mock_quiz = MagicMock()
    mock_quiz.data = {
        "id": "quiz-001",
        "title": "테스트 퀴즈",
        "questions": [
            {"id": "q1", "order_num": 1, "content": "문제1", "options": ["A", "B"], "answer": "A", "explanation": "해설1"},
            {"id": "q2", "order_num": 2, "content": "문제2", "options": ["C", "D"], "answer": "C", "explanation": "해설2"},
            {"id": "q3", "order_num": 3, "content": "문제3", "options": ["E", "F"], "answer": "E", "explanation": "해설3"}
        ]
    }
    mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_quiz

    # 3. 학생 답안 (quiz_submission_answers)
    mock_ans = MagicMock()
    mock_ans.data = [
        {"question_id": "q1", "selected_option": "A", "is_correct": True},
        {"question_id": "q2", "selected_option": "D", "is_correct": False},
        {"question_id": "q3", "selected_option": "E", "is_correct": True}
    ]
    mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_ans

    with patch("app.routers.quiz.supabase", mock_sb):
        response = client.get("/api/courses/course-001/quizzes/quiz-001/submissions/me")
        
    assert response.status_code == 200
    data = response.json()
    assert data["quizId"] == "quiz-001"
    assert data["score"] == 85.0
    assert len(data["questions"]) == 3
    assert data["questions"][0]["isCorrect"] is True
    assert data["questions"][1]["isCorrect"] is False
    assert data["questions"][1]["selectedOption"] == "D"
    assert data["questions"][1]["answer"] == "C"
    assert data["questions"][1]["explanation"] == "해설2"
    
    app.dependency_overrides.clear()

def test_get_my_submission_not_found():
    """제출 내역이 없는 경우 404 반환"""
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)

    mock_user = {"id": "student-abc", "role": "STUDENT"}
    app.dependency_overrides[get_current_user] = lambda: mock_user

    with patch("app.routers.quiz.supabase", mock_sb):
        response = client.get("/api/courses/course-001/quizzes/quiz-001/submissions/me")
    
    assert response.status_code == 404
    assert response.json()["message"] == "제출 내역이 없습니다."
    
    app.dependency_overrides.clear()
