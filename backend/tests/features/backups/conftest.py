"""
Fixtures para tests de la feature backups.

Estructura:
  backups_db_engine  — engine con tablas usuario, refresh_token, backup (session scope)
  db_session         — sesión SQLAlchemy por test; trunca al finalizar
  usuario_socio      — SOCIO activo
  usuario_abogado    — ABOGADO activo
  backup_ok          — registro Backup(tipo=AUTOMATICO, estado=OK)
  backup_error       — registro Backup(tipo=AUTOMATICO, estado=ERROR)
  client             — TestClient con dependency_override de get_db (requiere PostgreSQL)
  client_no_db       — TestClient con DB simulada (401/403 sin PostgreSQL)

Tests de integración (@pytest.mark.integration) requieren TEST_DATABASE_URL o DATABASE_URL.
Tests sin DB (401/403) usan client_no_db y corren en cualquier entorno.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

BACKEND_DIR = Path(__file__).parent.parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.rate_limit import limiter as _rate_limiter
from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_NOMBRE,
    ABOGADO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_NOMBRE,
    SOCIO_PASSWORD,
    hash_test_password,
)

# ── Reset del rate limiter ─────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    try:
        storage = _rate_limiter._limiter.storage
        if hasattr(storage, "reset"):
            storage.reset()
        elif hasattr(storage, "_storage") and isinstance(storage._storage, dict):
            storage._storage.clear()
    except Exception:
        pass
    yield


# ── Engine con tablas necesarias ──────────────────────────────────────────────


@pytest.fixture(scope="session")
def backups_db_engine(db_url):
    engine = create_engine(db_url)

    with engine.begin() as conn:
        # Crear enums necesarios
        for tipo, valores in [
            ("rol_usuario", "('SOCIO', 'ABOGADO')"),
            ("tipo_backup", "('AUTOMATICO', 'MANUAL')"),
            ("estado_backup", "('OK', 'ERROR')"),
        ]:
            conn.execute(text(f"""
                DO $$ BEGIN
                    CREATE TYPE {tipo} AS ENUM {valores};
                EXCEPTION WHEN duplicate_object THEN NULL;
                END $$
            """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usuario (
                id            SERIAL PRIMARY KEY,
                email         VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                nombre        VARCHAR(120) NOT NULL,
                rol           rol_usuario NOT NULL,
                area          VARCHAR(50),
                matricula     VARCHAR(50),
                activo        BOOLEAN NOT NULL DEFAULT true,
                creado_en     TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS refresh_token (
                id          SERIAL PRIMARY KEY,
                usuario_id  INTEGER NOT NULL REFERENCES usuario(id),
                token       VARCHAR(255) UNIQUE NOT NULL,
                issued_at   TIMESTAMP NOT NULL DEFAULT NOW(),
                expires_at  TIMESTAMP NOT NULL,
                revoked     BOOLEAN NOT NULL DEFAULT false
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS backup (
                id        SERIAL PRIMARY KEY,
                fecha     TIMESTAMP NOT NULL DEFAULT NOW(),
                tipo      tipo_backup NOT NULL,
                estado    estado_backup NOT NULL,
                ubicacion VARCHAR(500)
            )
        """))

    yield engine

    with engine.begin() as conn:
        conn.execute(
            text("TRUNCATE backup, refresh_token, usuario RESTART IDENTITY CASCADE")
        )
    engine.dispose()


# ── Sesión por test ────────────────────────────────────────────────────────────


@pytest.fixture
def db_session(backups_db_engine) -> Session:
    SessionFactory = sessionmaker(
        bind=backups_db_engine,
        autocommit=False,
        autoflush=False,
    )
    session = SessionFactory()
    yield session
    session.close()
    with backups_db_engine.begin() as conn:
        conn.execute(
            text("TRUNCATE backup, refresh_token, usuario RESTART IDENTITY CASCADE")
        )


# ── Fixtures de datos ─────────────────────────────────────────────────────────


@pytest.fixture
def usuario_socio(db_session: Session):
    from app.features.auth.models import Usuario
    from app.shared.enums import RolUsuario

    user = Usuario(
        email=SOCIO_EMAIL,
        password_hash=hash_test_password(SOCIO_PASSWORD),
        nombre=SOCIO_NOMBRE,
        rol=RolUsuario.SOCIO,
        activo=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def usuario_abogado(db_session: Session):
    from app.features.auth.models import Usuario
    from app.shared.enums import AreaDerecho, RolUsuario

    user = Usuario(
        email=ABOGADO_EMAIL,
        password_hash=hash_test_password(ABOGADO_PASSWORD),
        nombre=ABOGADO_NOMBRE,
        rol=RolUsuario.ABOGADO,
        area=AreaDerecho.LABORAL,
        activo=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def backup_ok(db_session: Session):
    from app.features.backups.models import Backup
    from app.shared.enums import EstadoBackup, TipoBackup

    b = Backup(
        tipo=TipoBackup.AUTOMATICO,
        estado=EstadoBackup.OK,
        ubicacion="backup_2026-06-24.xlsx",
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    return b


@pytest.fixture
def backup_error(db_session: Session):
    from app.features.backups.models import Backup
    from app.shared.enums import EstadoBackup, TipoBackup

    b = Backup(
        tipo=TipoBackup.AUTOMATICO,
        estado=EstadoBackup.ERROR,
        ubicacion=None,
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    return b


# ── App de test ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def _test_app():
    from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
    from app.core.rate_limit import limiter
    from app.features.auth.router import router as auth_router
    from app.features.backups.router import router as backups_router

    _app = FastAPI(title="Iuris Test — Backups")
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _app.add_middleware(SecurityHeadersMiddleware)
    _app.add_middleware(CSRFMiddleware)
    _app.include_router(auth_router, prefix="/api/v1")
    _app.include_router(backups_router, prefix="/api/v1")

    @_app.get("/health")
    def _health():
        return {"status": "UP"}

    return _app


# ── Clientes de test ───────────────────────────────────────────────────────────


@pytest.fixture
def client(db_session: Session, _test_app):
    """TestClient con DB real sobreescrita. Requiere PostgreSQL."""
    from app.core.dependencies import get_db

    def override_get_db():
        yield db_session

    _test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(_test_app, raise_server_exceptions=False) as c:
        yield c
    _test_app.dependency_overrides.clear()


@pytest.fixture
def client_no_db(_test_app):
    """TestClient con DB simulada. Para tests sin PostgreSQL (401/403)."""
    from app.core.dependencies import get_db

    def override_get_db():
        yield MagicMock(spec=Session)

    _test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(_test_app, raise_server_exceptions=False) as c:
        yield c
    _test_app.dependency_overrides.clear()
