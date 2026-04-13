from functools import lru_cache
from typing import Final
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
import httpx
import logging

from .config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# JWKS에 올 수 있는 비대칭 alg (Supabase는 ES256이 일반적; 키 종류에 따라 RS256도 허용)
_JWT_ALGORITHMS_JWKS: Final[tuple[str, ...]] = ("ES256", "RS256")


# @lru_cache(maxsize=1)
# def _jwks_client() -> PyJWKClient:
#     uri = settings.supabase_jwks_uri()
#     # 일부 호스팅/엣지에서 anon 키를 요구하는 경우가 있어 apikey 헤더를 붙인다 (공개 JWKS라 무해).
#     headers: dict[str, str] = {}
#     if (settings.SUPABASE_KEY or "").strip():
#         headers["apikey"] = settings.SUPABASE_KEY.strip()
#     return PyJWKClient(uri, headers=headers or None)


def _extract_bearer_token(credentials: HTTPAuthorizationCredentials | None) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다.")
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authorization은 Bearer 스킴이어야 합니다.")
    token = (credentials.credentials or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다.")
    return token

@lru_cache(maxsize=1000)
def _get_user_from_supabase_cached(token: str) -> dict:
    """Supabase API 반복 호출로 인한 Rate Limit 방지용 캐싱.
    로컬의 ES256/RS256 비대칭 키 검증 에러를 원천 차단하기 위해 
    REST API를 직접 호출하여 서버 측에서 안전하게 토큰을 검증합니다."""
    url = f"{settings.SUPABASE_URL}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.SUPABASE_KEY
    }
    try:
        response = httpx.get(url, headers=headers, timeout=10.0)
        response.raise_for_status()
        user_data = response.json()
        
        return {
            "sub": user_data.get("id"),
            "email": user_data.get("email"),
            "user_metadata": user_data.get("user_metadata", {}),
        }
    except Exception as e:
        print(f"Supabase /user endpoint failed: {e}")
        raise ValueError("Supabase Auth API 검증 실패")

def _decode_token(token: str) -> dict:
    try:
        # 1. 서명 검증 없이 페이로드만 추출 (로컬의 ES256 시크릿 키 불일치 에러 완벽 회피)
        unverified_payload = jwt.get_unverified_claims(token)
        
        # 2. Supabase Auth API를 통해 실제 토큰 유효성을 서버에서 검증 (캐싱 적용)
        user_info = _get_user_from_supabase_cached(token)
        
        # 3. 사용자 정보 병합 후 반환
        unverified_payload.update(user_info)
        return unverified_payload
        
    except Exception as e:
        print(f"JWT Verification Failed: {e}")  # 서버 로그(Railway) 확인용
        raise HTTPException(status_code=401, detail=f"토큰 검증 실패: {str(e)}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    from ..database import supabase

    token = _extract_bearer_token(credentials)
    payload = _decode_token(token)
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="토큰에서 사용자 정보를 확인할 수 없습니다.")

    # 1. 프로필 조회 (삭제 여부 확인)
    profile_data = None
    try:
        result = supabase.table("profiles").select("id, name, email, role, deleted_at").eq("id", user_id).maybe_single().execute()
        profile_data = result.data
    except Exception as e:
        logger.warning("Supabase profiles 조회 실패 (user_id=%s): %s", user_id, e)

    # 2. 탈퇴한 계정인 경우 처리
    if profile_data and profile_data.get("deleted_at") is not None:
        try:
            # [핵심] 탈퇴한 계정으로 다시 접근한 경우, Supabase Auth에서도 영구 삭제를 시도합니다.
            # 이를 통해 사용자가 동일한 이메일로 다시 가입할 수 있게 됩니다.
            supabase.auth.admin.delete_user(user_id)
            logger.info("탈퇴한 계정(좀비 계정) 영구 삭제 완료 (user_id=%s)", user_id)
        except Exception as delete_err:
            logger.error("좀비 계정 영구 삭제 실패 (user_id=%s): %s", user_id, delete_err)
        
        raise HTTPException(
            status_code=403, 
            detail="이미 탈퇴 처리된 계정입니다. 계정 정보가 완전히 삭제되었으니 다시 회원가입을 진행해주세요."
        )

    # 3. 프로필이 존재하는 경우 반환
    if profile_data:
        return profile_data

    # 4. 프로필이 없는데 인증은 된 경우 (인증 정보만 남은 경우)
    logger.info("profiles 미존재 — JWT 클레임으로 폴백 (user_id=%s)", user_id)
    meta = payload.get("user_metadata") or {}
    email = payload.get("email") or ""
    
    # 만약 profiles에 데이터가 없는데 인증이 성공했다면, 이는 이미 삭제되었거나 비정상적인 상태입니다.
    # 다시 가입할 수 있도록 정보를 반환하되, 명확한 역할을 부여합니다.
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
