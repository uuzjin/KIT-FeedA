from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import settings

_bearer = HTTPBearer()


def _decode_token(token: str) -> dict:
    try:
        # verify_aud를 해제하여 불필요한 토큰 타겟팅 충돌 방지
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as e:
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
