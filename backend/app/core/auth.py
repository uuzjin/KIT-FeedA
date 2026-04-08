from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import settings

_bearer = HTTPBearer()


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="인증 토큰이 유효하지 않거나 만료되었습니다.")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    from ..database import supabase

    payload = _decode_token(credentials.credentials)
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
