from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración centralizada leída del entorno."""

    # ── Base de datos ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://iuris:iuris@db:5432/iuris"

    # ── Logging ────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    # ── JWT / Auth ─────────────────────────────────────────────────
    # IMPORTANTE: en producción usar un secreto real (openssl rand -hex 32)
    JWT_SECRET: str = "change-me-in-production-use-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    # ── n8n / Webhooks ─────────────────────────────────────────────
    # use real secret: openssl rand -hex 32
    N8N_WF01_WEBHOOK_URL: str = "http://n8n:5678/webhook/wf-01-generar-actualizacion"
    N8N_WF02_WEBHOOK_URL: str = "http://n8n:5678/webhook/wf-02-respaldo"
    N8N_INTERNAL_SECRET: str = "change-me-use-openssl-rand-hex-32"
    # El AI Agent hace tool-calling (LLM -> tool HTTP -> LLM); 60s da margen
    # razonable antes de considerar el servicio de IA no disponible.
    N8N_WEBHOOK_TIMEOUT_SECONDS: float = 60.0

    # ── Rate limiting ──────────────────────────────────────────────
    RATE_LIMIT: str = "5/minute"  # límite para el endpoint de login

    # ── Cookies ────────────────────────────────────────────────────
    COOKIE_SECURE: bool = False       # True en producción (requiere HTTPS)
    COOKIE_SAMESITE: str = "lax"      # "lax" | "strict" | "none"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # ignora claves de .env que aún no consume el backend
    )


settings = Settings()
