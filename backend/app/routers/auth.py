from fastapi import APIRouter

from ..schemas import LoginRequest, SignupRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup")
def signup(payload: SignupRequest):
    return {
        "message": "회원가입 요청이 접수되었습니다.",
        "user": {"email": payload.email, "name": payload.name, "role": payload.role},
    }


@router.post("/login")
def login(payload: LoginRequest):
    return {
        "message": "로그인 성공",
        "access_token": "mock-token-for-mvp",
        "email": payload.email,
    }
