"""
Supabase Auth 액세스 토큰 검증 (JWKS / 비대칭 키).

[과거 HS256 + SUPABASE_JWT_SECRET 방식이 깨지는 이유]
- HS256(HMAC)은 **서명과 검증에 동일한 공유 비밀**이 필요하다.
- Supabase가 ES256(타원곡선 ECDSA) 등 **비대칭 서명**으로 발급하면, 서명은 **개인키**로 만들고
  검증은 **공개키**로 해야 한다. 이때 JWT Secret 문자열만으로는 ES256 서명을 검증할 수 없다.
- 따라서 대칭키로 `jwt.decode(..., algorithms=["HS256"], key=JWT_SECRET)` 하면
  alg 불일치(또는 서명 검증 실패)로 401이 난다. 공개키는 JWKS 엔드포인트에서 내려받는 것이 정석이다.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Final

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError, PyJWKClientError

from .config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# JWKS에 올 수 있는 비대칭 alg (Supabase는 ES256이 일반적; 키 종류에 따라 RS256도 허용)
_JWT_ALGORITHMS_JWKS: Final[tuple[str, ...]] = ("ES256", "RS256")


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    uri = settings.supabase_jwks_uri()
    # 일부 호스팅/엣지에서 anon 키를 요구하는 경우가 있어 apikey 헤더를 붙인다 (공개 JWKS라 무해).
    headers: dict[str, str] = {}
    if (settings.SUPABASE_KEY or "").strip():
        headers["apikey"] = settings.SUPABASE_KEY.strip()
    return PyJWKClient(uri, headers=headers or None)


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
    try:
        header = jwt.get_unverified_header(token)
        logger.info("JWT unverified header: alg=%s kid=%s", header.get("alg"), header.get("kid"))
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="토큰 형식이 올바르지 않습니다.") from exc

    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
    except PyJWKClientError as exc:
        logger.warning("JWKS에서 서명 키 조회 실패: %s", exc)
        raise HTTPException(
            status_code=401,
            detail="인증 서버의 공개키(JWKS)를 불러오지 못했거나 토큰의 kid와 일치하는 키가 없습니다.",
        ) from exc

    try:
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=list(_JWT_ALGORITHMS_JWKS),
            audience="authenticated",
            issuer=settings.supabase_jwt_issuer(),
        )
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="인증 토큰이 만료되었습니다.") from exc
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=401,
            detail="인증 토큰이 유효하지 않거나 서명·issuer·audience 검증에 실패했습니다.",
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

    try:
        result = supabase.table("profiles").select("id, name, email, role, deleted_at").eq("id", user_id).maybe_single().execute()
        data = result.data
    except Exception as e:
        logger.warning("Supabase profiles 조회 실패 (user_id=%s): %s", user_id, e)
        data = None

    if data:
        if data.get("deleted_at") is not None:
            raise HTTPException(status_code=403, detail="탈퇴 처리된 계정입니다.")
        return data

    logger.info("profiles 미존재/조회 불가 — JWT 클레임으로 폴백 (user_id=%s)", user_id)
    meta = payload.get("user_metadata") or {}
    email = payload.get("email") or ""
    return {
        "id": user_id,
        "email": email,
        "name": meta.get("name", email.split("@")[0] if email else "사용자"),
        "role": meta.get("role", "STUDENT"),
    }


async def require_instructor(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "INSTRUCTOR":
        raise HTTPException(status_code=403, detail="강사진만 접근할 수 있습니다.")
    return user
