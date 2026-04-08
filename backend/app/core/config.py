from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str
    GOOGLE_API_KEY: str
    WHISPER_MODEL_SIZE: str = "base"

    model_config = {"env_file": ("../.env", ".env"), "extra": "ignore"}


settings = Settings()
