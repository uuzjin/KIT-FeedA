from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_JWKS_URL: str = ""
    SUPABASE_JWT_ISSUER: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    GOOGLE_API_KEY: str
    WHISPER_MODEL_SIZE: str = "base"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    KAKAO_ACCESS_TOKEN: str = ""

    MOODLE_BASE_URL: str = ""
    MOODLE_API_TOKEN: str = ""
    CANVAS_BASE_URL: str = ""
    CANVAS_API_TOKEN: str = ""
    BLACKBOARD_BASE_URL: str = ""
    BLACKBOARD_API_KEY: str = ""
    BLACKBOARD_API_SECRET: str = ""

    FRONTEND_BASE_URL: str = "https://frontend-production-90dc.up.railway.app"
    CORS_ALLOW_ORIGINS: str = ""

    def supabase_jwks_uri(self) -> str:
        custom = (self.SUPABASE_JWKS_URL or "").strip()
        if custom:
            return custom.rstrip("/")
        base = self.SUPABASE_URL.rstrip("/")
        return f"{base}/auth/v1/.well-known/jwks.json"

    def supabase_jwt_issuer(self) -> str:
        custom = (self.SUPABASE_JWT_ISSUER or "").strip()
        if custom:
            return custom.rstrip("/")
        return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1"

    def cors_allow_origins(self) -> list[str]:
        configured = [
            origin.strip().rstrip("/")
            for origin in (self.CORS_ALLOW_ORIGINS or "").split(",")
            if origin.strip()
        ]
        if configured:
            return configured
        return [
            self.FRONTEND_BASE_URL.rstrip("/"),
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    model_config = {"env_file": ("../.env", ".env"), "extra": "ignore"}


settings = Settings()
