from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
APP_DIR = BACKEND_DIR / "app"


class Settings(BaseSettings):
    app_name: str = "Ahar API"
    environment: str = "development"
    debug: bool = True
    gemini_fallback_models: str = ""
    api_v1_prefix: str = "/api"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    google_client_id: str | None = None
    database_url: str
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000"
    )

    model_artifacts_dir: str = str(
        APP_DIR / "ml" / "artifacts"

    )
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.6-flash"

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug_setting(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "production", "prod", "false", "no", "off", "0"}:
                return False
            if normalized in {"development", "debug", "dev", "true", "yes", "on", "1"}:
                return True
        return value

    @property
    def gemini_model_list(self) -> list[str]:
        models = [self.gemini_model]

        for model in self.gemini_fallback_models.split(","):
            model = model.strip()

            if model and model not in models:
                models.append(model)

        return models

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
