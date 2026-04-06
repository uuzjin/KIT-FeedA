from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/materials", tags=["materials"])

_audio_tasks: dict[str, dict] = {}


class AudioConvertRequest(BaseModel):
    file_name: str
    estimated_minutes: int = 2


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _task_view(task_id: str) -> dict:
    task = _audio_tasks[task_id]
    started_at = task["started_at"]
    eta_seconds = max(task["estimated_minutes"] * 60, 30)
    elapsed = int((_now() - started_at).total_seconds())
    progress = min(int((elapsed / eta_seconds) * 100), 100)
    done = progress >= 100
    return {
        "task_id": task_id,
        "file_name": task["file_name"],
        "status": "completed" if done else "processing",
        "progress": progress,
        "transcript_preview": (
            "자동 변환 완료: 핵심 개념 요약과 Q&A 초안을 생성했습니다." if done else None
        ),
    }


@router.post("/audio-convert")
def create_audio_convert_task(payload: AudioConvertRequest):
    task_id = str(uuid4())
    _audio_tasks[task_id] = {
        "file_name": payload.file_name,
        "estimated_minutes": payload.estimated_minutes,
        "started_at": _now(),
    }
    return _task_view(task_id)


@router.get("/audio-convert/{task_id}")
def get_audio_convert_task(task_id: str):
    if task_id not in _audio_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_view(task_id)
