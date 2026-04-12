from functools import lru_cache
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import httpx

from .config import settings

_bearer = HTTPBearer()

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
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    from ..database import supabase

    payload = _decode_token(credentials.credentials)
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="토큰에서 사용자 정보를 확인할 수 없습니다.")

    try:
        result = supabase.table("profiles").select("id, name, email, role, deleted_at").eq("id", user_id).maybe_single().execute()
        data = result.data
    except Exception as e:
        print(f"Supabase DB profile query failed: {e}")
        data = None

    if data:
        if data.get("deleted_at") is not None:
            raise HTTPException(status_code=403, detail="탈퇴 처리된 계정입니다.")
        return data

    # DB 조회 실패(RLS 권한 문제 등) 시 JWT 토큰의 메타데이터를 사용하여 인증 통과
    print(f"Fallback to token metadata for user: {user_id}")
    meta = payload.get("user_metadata", {})
    email = payload.get("email", "")
    return {
        "id": user_id,
        "email": email,
        "name": meta.get("name", email.split("@")[0] if email else "사용자"),
        "role": meta.get("role", "STUDENT")
    }


async def require_instructor(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "INSTRUCTOR":
        raise HTTPException(status_code=403, detail="강사진만 접근할 수 있습니다.")
    return user
