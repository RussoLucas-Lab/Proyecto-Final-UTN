"""
Fixtures para tests del feature clientes.

Estructura:
  clientes_db_engine — engine con tablas usuario + refresh_token + cliente (session scope)
  db_session         — sesión SQLAlchemy por test; trunca al finalizar (function scope)
  client             — TestClient con app completa + DB real (function scope)
  client_no_db       — TestClient con DB simulada, para tests sin PostgreSQL (function scope)
  usuario_socio      — SOCIO activo insertado en DB
  usuario_abogado    — ABOGADO activo insertado en DB

Tests de integración (@pytest.mark.integration) requieren TEST_DATABASE_URL o DATABASE_URL.
Tests sin DB (CSRF, sin sesión) usan client_no_db y corren en cualquier entorno.
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

# Asegurar que backend/ esté en sys.path
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

# ── Datos sintéticos de clientes (base sintética, Ley 25.326) ─────────────────

CLIENTE_DATOS = {
    "nombre": "García Rodríguez, Juan",
    "dni": "28456123",
    "cuil": "20-28456123-4",
    "telefono": "0261-4567890",
    "email": "juan.garcia@iuris.test",
    "domicilio_real": "Av. San Martín 1234",
    "domicilio_real_cp": "5500",
    "domicilio_real_localidad": "Mendoza",
    "domicilio_real_provincia": "Mendoza",
    "domicilio_coincide_dni": True,
}

CLIENTE_DATOS_2 = {
    "nombre": "López Fernández, Ana",
    "dni": "31782004",
    "cuil": "27-31782004-3",
    "telefono": None,
    "email": None,
    "domicilio_real": None,
    "domicilio_real_cp": None,
    "domicilio_real_localidad": None,
    "domicilio_real_provincia": None,
    "domicilio_coincide_dni": None,
}


# ── Reset del rate limiter entre tests ────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Limpia el estado in-memory del rate limiter antes de cada test."""
    try:
        storage = _rate_limiter._limiter._storage
        if hasattr(storage, "reset"):
            storage.reset()
        elif hasattr(storage, "_storage") and isinstance(storage._storage, dict):
            storage._storage.clear()
    except Exception:
        pass
    yield


# ── Engine con tablas necesarias ──────────────────────────────────────────────


@pytest.fixture(scope="session")
def clientes_db_engine(db_url):
    """Engine con tablas usuario + refresh_token + cliente.

    Idempotente: usa CREATE TABLE IF NOT EXISTS y DO para enums.
    Trunca los datos al finalizar la sesión de tests.
    """
    engine = create_engine(db_url)

    with engine.begin() as conn:
        # Enums
        conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE rol_usuario AS ENUM ('SOCIO', 'ABOGADO');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        """))
        conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE area_derecho AS ENUM ('LABORAL', 'ART');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        """))

        # Tabla usuario
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usuario (
                id            SERIAL PRIMARY KEY,
                email         VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                nombre        VARCHAR(120) NOT NULL,
                rol           rol_usuario NOT NULL,
                area          area_derecho,
                matricula     VARCHAR(50),
                activo        BOOLEAN NOT NULL DEFAULT true,
                creado_en     TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))

        # Tabla refresh_token
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

        # Tabla cliente
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cliente (
                id                        SERIAL PRIMARY KEY,
                nombre                    VARCHAR(120) NOT NULL,
                dni                       VARCHAR(20) UNIQUE NOT NULL,
                cuil                      VARCHAR(20),
                telefono                  VARCHAR(30),
                email                     VARCHAR(120),
                domicilio_real            VARCHAR(255),
                domicilio_real_cp         VARCHAR(20),
                domicilio_real_localidad  VARCHAR(120),
                domicilio_real_provincia  VARCHAR(120),
                domicilio_coincide_dni    BOOLEAN,
                creado_en                 TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))

    yield engine

    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
        ))
    engine.dispose()


# ── Sesión por test ────────────────────────────────────────────────────────────


@pytest.fixture
def db_session(clientes_db_engine) -> Session:
    """Sesión SQLAlchemy para un test individual. Trunca al finalizar."""
    SessionFactory = sessionmaker(
        bind=clientes_db_engine,
        autocommit=False,
        autoflush=False,
    )
    session = SessionFactory()

    yield session

    session.close()
    with clientes_db_engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
        ))


# ── Usuarios sintéticos ────────────────────────────────────────────────────────


@pytest.fixture
def usuario_socio(db_session: Session):
    """Usuario SOCIO activo con contraseña conocida."""
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
    """Usuario ABOGADO activo (área LABORAL) con contraseña conocida."""
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


# ── App de test ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def _test_app():
    """App FastAPI de test con routers de auth, usuarios y clientes registrados."""
    from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
    from app.core.rate_limit import limiter
    from app.features.auth.router import router as auth_router
    from app.features.clientes.router import router as clientes_router
    from app.features.usuarios.router import router as usuarios_router

    _app = FastAPI(title="Iuris Test — Clientes")
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _app.add_middleware(SecurityHeadersMiddleware)
    _app.add_middleware(CSRFMiddleware)
    _app.include_router(auth_router, prefix="/api/v1")
    _app.include_router(usuarios_router, prefix="/api/v1")
    _app.include_router(clientes_router, prefix="/api/v1")

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
    """TestClient con DB simulada (MagicMock). Para tests sin PostgreSQL."""
    from app.core.dependencies import get_db

    def override_get_db():
        yield MagicMock(spec=Session)

    _test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(_test_app, raise_server_exceptions=False) as c:
        yield c
    _test_app.dependency_overrides.clear()
