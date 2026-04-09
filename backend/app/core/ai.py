"""AI API 클라이언트.

- Google Gemini 2.0 Flash Lite : 1단계 구조 분석 (빠름, 무료 티어 넉넉함)
- Google Gemini 2.0 Flash      : 2단계 제안/퀴즈 생성 (고품질, 무료 티어)
- faster-whisper               : 오디오 텍스트 변환 (완전 로컬, 무료)

함수 시그니처는 이전 구현과 동일하게 유지 — 라우터/프롬프트 변경 없음.
"""
import hashlib
import json
import time
from typing import Any

from google import genai
from google.genai import types

from .config import settings

# ── 인메모리 AI 응답 캐시 ──────────────────────────────────────────────────────
_ai_cache: dict[str, tuple[Any, float]] = {}
_CACHE_TTL = 3600  # 1시간 (초)


def _cache_key(model: str, system: str, user: str) -> str:
    raw = f"{model}\x00{system}\x00{user}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_get(key: str) -> tuple[bool, Any]:
    entry = _ai_cache.get(key)
    if entry and time.time() - entry[1] < _CACHE_TTL:
        return True, entry[0]
    return False, None


def _cache_set(key: str, value: Any) -> None:
    _ai_cache[key] = (value, time.time())


def clear_ai_cache() -> None:
    """테스트 또는 수동 캐시 초기화용."""
    _ai_cache.clear()

# ── Gemini 클라이언트 초기화 ──────────────────────────────────────────────────
_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

# 모델 상수
_MODEL_FAST = "gemini-2.0-flash-lite"   # 1단계 구조 분석 (30 RPM 무료)
_MODEL_PRO  = "gemini-2.0-flash"        # 2단계 제안/퀴즈 (15 RPM 무료)

# ── faster-whisper 지연 로드 ──────────────────────────────────────────────────
_whisper_model = None


def _get_whisper():
    """faster-whisper 모델을 최초 호출 시 한 번만 로드."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            settings.WHISPER_MODEL_SIZE,
            device="cpu",
            compute_type="int8",
        )
    return _whisper_model


# ── Gemini 호출 내부 헬퍼 ─────────────────────────────────────────────────────
def _call_gemini(model_name: str, system: str, user: str, max_tokens: int = 4096) -> str:
    response = _client.models.generate_content(
        model=model_name,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text


def _parse_json(raw: str) -> Any:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        # 첫 줄(```json 또는 ```) 과 마지막 줄(```) 제거
        inner = lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        raw = "\n".join(inner)
    return json.loads(raw.strip())


# ── 공개 함수 (라우터에서 호출) ───────────────────────────────────────────────

def call_haiku(system: str, user: str, max_tokens: int = 2048) -> str:
    """Gemini Flash Lite 텍스트 응답 (구 Haiku 역할)."""
    return _call_gemini(_MODEL_FAST, system, user, max_tokens)


def call_sonnet(system: str, user: str, max_tokens: int = 4096) -> str:
    """Gemini Flash 텍스트 응답 (구 Sonnet 역할)."""
    return _call_gemini(_MODEL_PRO, system, user, max_tokens)


def call_haiku_json(system: str, user: str, max_tokens: int = 2048, use_cache: bool = False) -> Any:
    """Gemini Flash Lite JSON 응답.

    use_cache=True 시 동일 입력에 대한 캐시 결과 반환 (GET 조회용 한정).
    POST 비동기 생성 시에는 use_cache=False(기본값) 사용.
    """
    full_user = user + "\n\n반드시 JSON만 출력하세요. 코드 블록(```json ... ```)을 사용해도 됩니다. 다른 설명은 출력하지 마세요."
    if use_cache:
        key = _cache_key(_MODEL_FAST, system, full_user)
        hit, cached = _cache_get(key)
        if hit:
            return cached
        result = _parse_json(call_haiku(system, full_user, max_tokens))
        _cache_set(key, result)
        return result
    return _parse_json(call_haiku(system, full_user, max_tokens))


def call_sonnet_json(system: str, user: str, max_tokens: int = 4096, use_cache: bool = False) -> Any:
    """Gemini Flash JSON 응답.

    use_cache=True 시 동일 입력에 대한 캐시 결과 반환 (GET 조회용 한정).
    POST 비동기 생성 시에는 use_cache=False(기본값) 사용.
    """
    full_user = user + "\n\n반드시 JSON만 출력하세요. 코드 블록(```json ... ```)을 사용해도 됩니다. 다른 설명은 출력하지 마세요."
    if use_cache:
        key = _cache_key(_MODEL_PRO, system, full_user)
        hit, cached = _cache_get(key)
        if hit:
            return cached
        result = _parse_json(call_sonnet(system, full_user, max_tokens))
        _cache_set(key, result)
        return result
    return _parse_json(call_sonnet(system, full_user, max_tokens))


def transcribe_audio(file_path: str, file_name: str) -> dict:
    """faster-whisper로 로컬에서 오디오 텍스트 변환 (완전 무료)."""
    model = _get_whisper()

    segments_iter, info = model.transcribe(
        file_path,
        language="ko",    # 한국어 우선 (자동 감지 원하면 None으로)
        beam_size=5,
        vad_filter=True,  # 침묵 구간 자동 제거
    )

    segments = []
    full_text_parts = []

    for seg in segments_iter:
        segments.append({
            "startTime": round(seg.start, 2),
            "endTime": round(seg.end, 2),
            "text": seg.text.strip(),
        })
        full_text_parts.append(seg.text.strip())

    return {
        "transcript": " ".join(full_text_parts),
        "segments": segments,
    }
