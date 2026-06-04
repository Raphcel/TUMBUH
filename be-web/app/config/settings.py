from functools import lru_cache
import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, DotEnvSettingsSource, EnvSettingsSource, PydanticBaseSettingsSource, SettingsConfigDict


class CorsOriginsSourceMixin:
    """Disable eager JSON decoding for env fields that we parse manually."""

    def prepare_field_value(self, field_name, field, value, value_is_complex):
        if field_name == "CORS_ORIGINS":
            return value
        return super().prepare_field_value(field_name, field, value, value_is_complex)


class SettingsEnvSource(CorsOriginsSourceMixin, EnvSettingsSource):
    pass


class SettingsDotEnvSource(CorsOriginsSourceMixin, DotEnvSettingsSource):
    pass


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        enable_decoding=False,
        extra="ignore",
    )

    APP_NAME: str = "IPB Career Tracker API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/career_tracker"

    # Connection pool settings
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FIELD_ENCRYPTION_KEY: str | None = None
    DIGITAL_SIGNATURE_PRIVATE_KEY: str | None = None

    EMAIL_ENABLED: bool = False
    RESEND_API_KEY: str | None = None
    EMAIL_FROM: str | None = None
    EMAIL_REPLY_TO: str | None = None
    FRONTEND_URL: str = "http://localhost:5173"
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_EXPIRE_HOURS: int = 1
    GOOGLE_CLIENT_ID: str | None = None
    AUDIT_DASHBOARD_KEY: str | None = None

    EMAIL_ENABLED: bool = False
    RESEND_API_KEY: str | None = None
    EMAIL_FROM: str | None = None
    EMAIL_REPLY_TO: str | None = None
    FRONTEND_URL: str = "http://localhost:5173"
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24
    GOOGLE_CLIENT_ID: str | None = None

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://localhost:3000",
    ]
    CORS_ORIGIN_REGEX: str | None = r"^https?://(localhost|127\.0\.0\.1):\d+$"

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ):
        return (
            init_settings,
            SettingsEnvSource(settings_cls),
            SettingsDotEnvSource(settings_cls),
            file_secret_settings,
        )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        """Allow CORS_ORIGINS from env as JSON array or comma-separated string."""
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if value.startswith("["):
                return json.loads(value)
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
