from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/notices", tags=["notices"])

_settings = {
    "channels": ["email"],
    "deadline_hours_before": 24,
    "quiz_notifications": True,
}


@router.get("")
def list_notices():
    return [
        {"id": 1, "title": "7주차 예습 자료 업로드 완료", "type": "자료"},
        {"id": 2, "title": "퀴즈 마감 24시간 전 알림", "type": "마감"},
    ]


class NoticeSettings(BaseModel):
    channels: list[str]
    deadline_hours_before: int
    quiz_notifications: bool


@router.get("/settings")
def get_settings():
    return _settings


@router.post("/settings")
def update_settings(payload: NoticeSettings):
    _settings.update(payload.model_dump())
    return {"message": "알림 설정이 저장되었습니다.", "settings": _settings}
