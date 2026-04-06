from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

_latest_quiz = {
    "title": "Week 6 이해도 점검",
    "questions": 5,
    "anonymous_enabled": True,
    "accuracy": 74,
    "hard_questions": ["Q3", "Q5"],
}


class QuizGenerateRequest(BaseModel):
    topic: str
    difficulty: str = "mixed"
    question_count: int = 5


@router.get("/latest")
def get_latest_quiz():
    return _latest_quiz


@router.post("/generate")
def generate_quiz(payload: QuizGenerateRequest):
    _latest_quiz.update(
        {
            "title": f"{payload.topic} 자동 생성 퀴즈",
            "questions": payload.question_count,
            "anonymous_enabled": True,
            "accuracy": 0,
            "hard_questions": [],
        }
    )
    return {
        "message": "퀴즈가 생성되었습니다.",
        "quiz": _latest_quiz,
        "difficulty": payload.difficulty,
    }
