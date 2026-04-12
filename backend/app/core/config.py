from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str
    SUPABASE_SERVICE_KEY: str = ""   # auth.admin 작업용 (탈퇴 계정 영구 삭제)
    GOOGLE_API_KEY: str
    WHISPER_MODEL_SIZE: str = "base"

    # ── CORS 허용 도메인 ───────────────────────────────────────────────────────
    FRONTEND_URL: str = "https://frontend-production-90dc.up.railway.app"

    # ── 이메일 (SMTP) ──────────────────────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""              # 미설정 시 SMTP_USER 사용

    # ── 카카오 알림톡 ──────────────────────────────────────────────────────────
    KAKAO_ACCESS_TOKEN: str = ""     # 카카오 비즈니스 API 액세스 토큰

    # ── LMS ───────────────────────────────────────────────────────────────────
    MOODLE_BASE_URL: str = ""        # 예: https://moodle.example.com
    MOODLE_API_TOKEN: str = ""
    CANVAS_BASE_URL: str = ""        # 예: https://canvas.instructure.com
    CANVAS_API_TOKEN: str = ""
    BLACKBOARD_BASE_URL: str = ""    # 예: https://blackboard.example.com
    BLACKBOARD_API_KEY: str = ""
    BLACKBOARD_API_SECRET: str = ""

    # 초대 링크에 사용할 프론트엔드 베이스 URL (예: https://app.example.com)
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    def supabase_jwks_uri(self) -> str:
        """JWKS(JSON Web Key Set) 문서 URL. SUPABASE_JWKS_URL이 있으면 그대로 사용."""
        custom = (self.SUPABASE_JWKS_URL or "").strip()
        if custom:
            return custom.rstrip("/")
        base = self.SUPABASE_URL.rstrip("/")
        return f"{base}/auth/v1/.well-known/jwks.json"

    def supabase_jwt_issuer(self) -> str:
        """액세스 토큰 iss 클레임과 맞춘다 (Supabase 기본: {origin}/auth/v1)."""
        custom = (self.SUPABASE_JWT_ISSUER or "").strip()
        if custom:
            return custom.rstrip("/")
        return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1"

    model_config = {"env_file": ("../.env", ".env"), "extra": "ignore"}


settings = Settings()
