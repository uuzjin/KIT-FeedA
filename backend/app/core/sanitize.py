"""AI 프롬프트 인젝션 방어 유틸리티."""
import re

_MAX_PROMPT_LEN = 100_000  # 100KB


def sanitize_prompt_input(text: str, max_length: int = _MAX_PROMPT_LEN) -> str:
    """사용자 업로드 텍스트를 LLM 프롬프트에 삽입하기 전 새니타이징.

    - 제어 문자(NULL, ESC 등) 제거 (탭·개행 유지)
    - 길이 상한 적용
    """
    if not text:
        return ""
    # 제어 문자 제거 (탭 \x09, 개행 \x0a, 캐리지 리턴 \x0d는 유지)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return cleaned[:max_length]
