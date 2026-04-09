from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str
    SUPABASE_SERVICE_KEY: str = ""   # auth.admin 작업용 (탈퇴 계정 영구 삭제)
    GOOGLE_API_KEY: str
    WHISPER_MODEL_SIZE: str = "base"

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

    model_config = {"env_file": ("../.env", ".env"), "extra": "ignore"}


settings = Settings()
