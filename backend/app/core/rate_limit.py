"""slowapi Rate Limiter 공유 인스턴스.

라우터에서 임포트하여 @limiter.limit() 데코레이터로 사용.
main.py에서 app.state.limiter = limiter 로 등록.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# AI 엔드포인트 기본 제한: IP당 분당 10회
AI_RATE_LIMIT = "10/minute"
