import logging
from typing import Final

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

from .config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

_DEFAULT_JWT_ALGORITHMS: Final[tuple[str, ...]] = ("HS256",)


def _parse_allowed_algorithms() -> list[str]:
    raw = (settings.SUPABASE_JWT_ALGORITHMS or "").strip()
    if not raw:
        return list(_DEFAULT_JWT_ALGORITHMS)
    return [p.strip() for p in raw.split(",") if p.strip()]


def _extract_bearer_token(credentials: HTTPAuthorizationCredentials | None) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다.")
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authorization은 Bearer 스킴이어야 합니다.")
    token = (credentials.credentials or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다.")
    return token


def _decode_token(token: str) -> dict:
    """
    Supabase Auth 액세스 토큰 검증.

    NOTE: 과거 `python-jose`의 `jwt.decode(..., algorithms=[...])`는 토큰 헤더의 alg가
    허용 목록에 없을 때 **"The specified alg value is not allowed"** 를 발생시켰다.
    동일 토큰이라도 PyJWT로 교체·허용 alg를 환경변수로 맞추면 Railway 401이 해소되는 경우가 많다.
    """
    try:
        header = jwt.get_unverified_header(token)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="토큰 형식이 올바르지 않습니다.") from exc

    alg = header.get("alg")
    logger.info("JWT unverified header: alg=%s keys=%s", alg, list(header.keys()))

    allowed = _parse_allowed_algorithms()
    if alg not in allowed:
        raise HTTPException(
            status_code=401,
            detail=(
                f"허용되지 않은 JWT alg입니다: {alg!r}. "
                f"SUPABASE_JWT_ALGORITHMS(현재: {allowed})를 프로젝트 토큰 서명 방식에 맞게 설정하세요."
            ),
        )

    pem = (settings.SUPABASE_JWT_PUBLIC_KEY_PEM or "").strip().replace("\\n", "\n")
    if alg == "RS256":
        if not pem:
            raise HTTPException(
                status_code=401,
                detail="RS256 토큰인데 SUPABASE_JWT_PUBLIC_KEY_PEM이 비어 있습니다. 공개키 PEM을 설정하세요.",
            )
        key: str = pem
        decode_algorithms = ["RS256"]
    else:
        key = settings.SUPABASE_JWT_SECRET
        decode_algorithms = [a for a in allowed if a != "RS256"] or list(_DEFAULT_JWT_ALGORITHMS)

    try:
        return jwt.decode(
            token,
            key,
            algorithms=decode_algorithms,
            audience="authenticated",
        )
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="인증 토큰이 만료되었습니다.") from exc
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=401,
            detail="인증 토큰이 유효하지 않거나 서명·audience 검증에 실패했습니다.",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    from ..database import supabase

    token = _extract_bearer_token(credentials)
    payload = _decode_token(token)
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="토큰에서 사용자 정보를 확인할 수 없습니다.")

    result = supabase.table("profiles").select("id, name, email, role").eq("id", user_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="사용자 프로필을 찾을 수 없습니다.")
    if result.data.get("deleted_at") is not None:
        raise HTTPException(status_code=403, detail="탈퇴 처리된 계정입니다.")

    return result.data


async def require_instructor(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "INSTRUCTOR":
        raise HTTPException(status_code=403, detail="강사진만 접근할 수 있습니다.")
    return user
