"""Supabase Storage 유틸리티"""
import re

from fastapi import HTTPException, UploadFile

from ..database import supabase

# 버킷명 상수
BUCKET_SCRIPTS = "scripts"
BUCKET_AUDIOS = "audios"
BUCKET_PROFILES = "profiles"

ALLOWED_SCRIPT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # pptx
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",     # docx
    "text/plain",
}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}

MAX_SCRIPT_SIZE = 50 * 1024 * 1024   # 50MB
MAX_AUDIO_SIZE  = 500 * 1024 * 1024  # 500MB
MAX_IMAGE_SIZE  = 5 * 1024 * 1024    # 5MB


def _sanitize_filename(filename: str) -> str:
    """경로 순회(path traversal) 및 제어 문자 방어."""
    if not filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")
    # 경로 구분자 제거
    name = re.sub(r"[/\\]", "_", filename)
    # 제어 문자 제거
    name = re.sub(r"[\x00-\x1f\x7f]", "", name)
    if not name or name in (".", ".."):
        raise HTTPException(status_code=400, detail="유효하지 않은 파일명입니다.")
    return name


def _validate_file(file: UploadFile, allowed_types: set[str], max_size: int) -> None:
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 허용: {allowed_types}",
        )
    # size는 UploadFile이 스트림이므로 업로드 후 검증 (아래 upload_file에서 처리)


async def upload_file(
    file: UploadFile,
    bucket: str,
    path: str,
    allowed_types: set[str],
    max_size: int,
) -> str:
    """파일을 Supabase Storage에 업로드하고 storage path를 반환."""
    # 파일명 안전성 검증
    if file.filename:
        _sanitize_filename(file.filename)

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 허용: {', '.join(allowed_types)}",
        )

    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기가 너무 큽니다. 최대 {max_size // (1024 * 1024)}MB",
        )

    supabase.storage.from_(bucket).upload(
        path=path,
        file=content,
        file_options={"content-type": file.content_type, "upsert": "true"},
    )
    return path


def get_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """Signed URL 생성 (기본 1시간)."""
    result = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
    return result.get("signedURL") or result.get("signedUrl", "")


def delete_file(bucket: str, path: str) -> None:
    supabase.storage.from_(bucket).remove([path])
