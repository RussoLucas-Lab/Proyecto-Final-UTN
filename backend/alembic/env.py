"""
Alembic environment — Iuris.

Configuración clave:
  - La URL de la DB se lee de settings.DATABASE_URL (pydantic-settings),
    nunca hardcodeada en alembic.ini.
  - models_registry importa todos los features/*/models.py para que
    Base.metadata los conozca antes de autogenerar revisiones.
  - target_metadata = Base.metadata habilita el modo autogenerate.
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# ── path setup ────────────────────────────────────────────────────────────────
# Agrega backend/ al sys.path para que "from app.core..." sea importable
# tanto en Docker (WORKDIR /backend) como en local.
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# ── imports de la aplicación ──────────────────────────────────────────────────
from app.core.config import settings  # noqa: E402
from app.core.db_base import Base  # noqa: E402
import app.core.models_registry  # noqa: E402, F401  — registra todos los modelos

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config

# Sobreescribe la URL del alembic.ini con la de pydantic-settings.
# Esto es la fuente única de verdad; dev/Docker/CI usan la misma ruta.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# target_metadata habilita --autogenerate
target_metadata = Base.metadata


# ── helpers ───────────────────────────────────────────────────────────────────


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine.
    Calls to context.execute() emit the given string to the script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Creates an Engine and associates a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
