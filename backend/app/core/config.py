from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración centralizada leída del entorno.

    Las claves activas en este change son DATABASE_URL y LOG_LEVEL.
    Las demás (JWT, R2, n8n) se configuran en changes posteriores.
    """

    # ── Base de datos ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://iuris:iuris@db:5432/iuris"

    # ── Logging ────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # ignora claves de .env que aún no consume el backend
    )


settings = Settings()
