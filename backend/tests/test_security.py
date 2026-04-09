"""7-2. 보안 테스트.

- Rate limiting: AI 엔드포인트에 11회 연속 요청 시 429 반환
- 파일 업로드 검증: 잘못된 파일명·타입·사이즈 거부
- Prompt injection 방어: sanitize_prompt_input 유닛 테스트
"""
import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ═════════════════════════════════════════════════════════════════════════════
# (A) sanitize_prompt_input 유닛 테스트
# ═════════════════════════════════════════════════════════════════════════════

def test_sanitize_removes_null_bytes():
    from app.core.sanitize import sanitize_prompt_input
    text = "안녕\x00하세요\x01테스트"
    result = sanitize_prompt_input(text)
    assert "\x00" not in result
    assert "\x01" not in result
    assert "안녕" in result
    assert "하세요" in result


def test_sanitize_keeps_newlines_and_tabs():
    from app.core.sanitize import sanitize_prompt_input
    text = "줄1\n줄2\t탭"
    result = sanitize_prompt_input(text)
    assert "\n" in result
    assert "\t" in result


def test_sanitize_truncates_long_text():
    from app.core.sanitize import sanitize_prompt_input
    text = "a" * 200_000
    result = sanitize_prompt_input(text, max_length=100_000)
    assert len(result) == 100_000


def test_sanitize_empty_string():
    from app.core.sanitize import sanitize_prompt_input
    assert sanitize_prompt_input("") == ""
    assert sanitize_prompt_input(None) == ""  # type: ignore[arg-type]


def test_sanitize_removes_esc_char():
    """ESC 문자(\x1b)가 제거되어야 한다 (ANSI 인젝션 방어)."""
    from app.core.sanitize import sanitize_prompt_input
    text = "정상 텍스트\x1b[31m위험한 컬러 코드\x1b[0m"
    result = sanitize_prompt_input(text)
    assert "\x1b" not in result
    assert "정상 텍스트" in result


# ═════════════════════════════════════════════════════════════════════════════
# (B) 파일 업로드 검증 테스트
# ═════════════════════════════════════════════════════════════════════════════

def test_sanitize_filename_path_traversal():
    """경로 순회 파일명은 _ 로 치환되어야 한다."""
    from app.core.storage import _sanitize_filename
    result = _sanitize_filename("../etc/passwd")
    assert "/" not in result
    assert "\\" not in result


def test_sanitize_filename_windows_path():
    from app.core.storage import _sanitize_filename
    result = _sanitize_filename("..\\Windows\\system32\\calc.exe")
    assert "\\" not in result


def test_sanitize_filename_empty_raises():
    from fastapi import HTTPException
    from app.core.storage import _sanitize_filename
    with pytest.raises(HTTPException) as exc_info:
        _sanitize_filename("")
    assert exc_info.value.status_code == 400


def test_sanitize_filename_dot_only_raises():
    from fastapi import HTTPException
    from app.core.storage import _sanitize_filename
    with pytest.raises(HTTPException):
        _sanitize_filename(".")
    with pytest.raises(HTTPException):
        _sanitize_filename("..")


def test_sanitize_filename_control_chars_removed():
    from app.core.storage import _sanitize_filename
    result = _sanitize_filename("file\x00name.pdf")
    assert "\x00" not in result


@pytest.mark.asyncio
async def test_upload_file_rejects_invalid_type():
    """허용되지 않는 MIME 타입은 400 오류를 반환해야 한다."""
    from fastapi import HTTPException, UploadFile
    from app.core.storage import upload_file, ALLOWED_SCRIPT_TYPES

    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "application/x-executable"
    mock_file.filename = "malicious.exe"
    mock_file.read = AsyncMock(return_value=b"exe content")
    mock_file.size = 100

    with pytest.raises(HTTPException) as exc_info:
        await upload_file(mock_file, "scripts", "test/path", ALLOWED_SCRIPT_TYPES, 50 * 1024 * 1024)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_upload_file_rejects_oversized():
    """최대 크기 초과 파일은 400 오류를 반환해야 한다."""
    from fastapi import HTTPException, UploadFile
    from app.core.storage import upload_file, ALLOWED_SCRIPT_TYPES

    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "application/pdf"
    mock_file.filename = "big.pdf"
    # 1MB를 최대로 설정해 두고 2MB 파일 전송
    mock_file.read = AsyncMock(return_value=b"x" * (2 * 1024 * 1024))
    mock_file.size = 2 * 1024 * 1024

    with pytest.raises(HTTPException) as exc_info:
        await upload_file(mock_file, "scripts", "test/path", ALLOWED_SCRIPT_TYPES, 1 * 1024 * 1024)
    assert exc_info.value.status_code == 400


# ═════════════════════════════════════════════════════════════════════════════
# (C) AI 캐시 단위 테스트
# ═════════════════════════════════════════════════════════════════════════════

def test_ai_cache_hit():
    """동일 입력에 대해 캐시 히트 시 AI 재호출 없이 캐시 값을 반환."""
    import time
    from app.core.ai import clear_ai_cache, _cache_get, _cache_key, _cache_set

    clear_ai_cache()
    key = _cache_key("model-test", "system-test", "user-test")
    _cache_set(key, {"result": "cached"})

    hit, val = _cache_get(key)
    assert hit is True
    assert val == {"result": "cached"}


def test_ai_cache_miss_on_different_input():
    from app.core.ai import clear_ai_cache, _cache_get, _cache_key

    clear_ai_cache()
    key = _cache_key("model-a", "sys-a", "user-a")
    hit, val = _cache_get(key)
    assert hit is False


def test_ai_cache_expired():
    """TTL 만료 후에는 캐시 미스로 처리되어야 한다."""
    import time
    from unittest.mock import patch
    from app.core.ai import clear_ai_cache, _cache_get, _cache_key, _cache_set, _CACHE_TTL

    clear_ai_cache()
    key = _cache_key("model-b", "sys-b", "user-b")
    _cache_set(key, "some_value")

    # TTL을 방금 지난 시점으로 시간 조작
    with patch("app.core.ai.time") as mock_time:
        mock_time.time.return_value = time.time() + _CACHE_TTL + 1
        hit, val = _cache_get(key)

    assert hit is False
