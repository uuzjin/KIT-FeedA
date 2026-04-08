from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str

    model_config = {"env_file": ("../.env", ".env"), "extra": "ignore"}


settings = Settings()
