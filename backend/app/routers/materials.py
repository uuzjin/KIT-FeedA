import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from ..core.auth import get_current_user, require_instructor
from ..core.storage import (
    ALLOWED_AUDIO_TYPES,
    BUCKET_AUDIOS,
    MAX_AUDIO_SIZE,
    get_signed_url,
    upload_file,
)
from ..database import supabase

router = APIRouter(prefix="/api/courses/{course_id}/audios", tags=["materials"])


def _require_instructor_of(course_id: str, user_id: str) -> None:
    result = (
        supabase.table("course_instructors")
        .select("id")
        .eq("course_id", course_id)
        .eq("instructor_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="해당 강의의 담당 강사가 아닙니다.")


# ── 6.5.1 오디오 업로드 ───────────────────────────────────────────────────────
@router.post("", status_code=201)
async def upload_audio(
    course_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    schedule_id: str | None = Form(None),
    current_user: dict = Depends(require_instructor),
):
    _require_instructor_of(course_id, current_user["id"])

    file_id = str(uuid.uuid4())
    storage_path = f"{course_id}/{file_id}_{file.filename}"

    await upload_file(file, BUCKET_AUDIOS, storage_path, ALLOWED_AUDIO_TYPES, MAX_AUDIO_SIZE)

    result = supabase.table("audios").insert({
        "course_id": course_id,
        "schedule_id": schedule_id,
        "file_name": file.filename,
        "file_size": file.size or 0,
        "mime_type": file.content_type,
        "storage_path": storage_path,
        "status": "PROCESSING",
        "estimated_seconds": 120,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="오디오 업로드에 실패했습니다.")

    audio = result.data[0]

    background_tasks.add_task(_run_transcription, audio["id"], storage_path, file.filename)

    return {
        "audioId": audio["id"],
        "courseId": course_id,
        "fileName": audio["file_name"],
        "fileSize": audio["file_size"],
        "status": audio["status"],
        "uploadedAt": audio["uploaded_at"],
    }


async def _run_transcription(audio_id: str, storage_path: str, file_name: str) -> None:
    """OpenAI Whisper로 오디오 텍스트 변환."""
    import os
    import tempfile

    from ..core.ai import transcribe_audio

    try:
        # Storage에서 파일 다운로드
        file_bytes: bytes = supabase.storage.from_(BUCKET_AUDIOS).download(storage_path)

        # 임시 파일에 저장 후 Whisper 호출
        suffix = os.path.splitext(file_name)[1] or ".mp3"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            result = await transcribe_audio(tmp_path, file_name)
        finally:
            os.unlink(tmp_path)

        # 변환 결과 저장
        supabase.table("audio_transcripts").upsert({
            "audio_id": audio_id,
            "transcript": result["transcript"],
            "segments": result["segments"],
        }, on_conflict="audio_id").execute()

        supabase.table("audios").update({"status": "COMPLETED"}).eq("id", audio_id).execute()

    except Exception as e:
        supabase.table("audios").update({"status": "FAILED"}).eq("id", audio_id).execute()


# ── 오디오 목록 조회 ──────────────────────────────────────────────────────────
@router.get("")
def list_audios(course_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("audios")
        .select("*, audio_transcripts(transcript, completed_at)")
        .eq("course_id", course_id)
        .order("uploaded_at", desc=True)
        .execute()
    )
    audios = []
    for r in (result.data or []):
        transcript_info = r.get("audio_transcripts")
        audios.append({
            "audioId": r["id"],
            "fileName": r["file_name"],
            "fileSize": r["file_size"],
            "status": r["status"],
            "scheduleId": r.get("schedule_id"),
            "uploadedAt": r["uploaded_at"],
            "transcript": transcript_info[0]["transcript"][:200] + "..." if transcript_info else None,
            "transcriptCompletedAt": transcript_info[0]["completed_at"] if transcript_info else None,
        })
    return {"audios": audios, "totalCount": len(audios)}


# ── 오디오 상세 조회 (Signed URL 포함) ───────────────────────────────────────
@router.get("/{audio_id}")
def get_audio(course_id: str, audio_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("audios")
        .select("*, audio_transcripts(*)")
        .eq("id", audio_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="오디오를 찾을 수 없습니다.")

    r = result.data
    transcript_rows = r.get("audio_transcripts") or []
    transcript = transcript_rows[0] if transcript_rows else None

    return {
        "audioId": r["id"],
        "fileName": r["file_name"],
        "fileSize": r["file_size"],
        "status": r["status"],
        "scheduleId": r.get("schedule_id"),
        "uploadedAt": r["uploaded_at"],
        "downloadUrl": get_signed_url(BUCKET_AUDIOS, r["storage_path"]),
        "transcript": transcript["transcript"] if transcript else None,
        "segments": transcript["segments"] if transcript else [],
        "transcriptCompletedAt": transcript["completed_at"] if transcript else None,
    }


# ── 오디오 삭제 ───────────────────────────────────────────────────────────────
@router.delete("/{audio_id}", status_code=204)
def delete_audio(
    course_id: str,
    audio_id: str,
    current_user: dict = Depends(require_instructor),
):
    _require_instructor_of(course_id, current_user["id"])

    result = (
        supabase.table("audios")
        .select("storage_path")
        .eq("id", audio_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="오디오를 찾을 수 없습니다.")

    from ..core.storage import delete_file
    delete_file(BUCKET_AUDIOS, result.data["storage_path"])
    supabase.table("audios").delete().eq("id", audio_id).execute()
