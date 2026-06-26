"""
Fixtures para tests de autenticación.

Estructura:
  auth_db_engine  — engine con tablas usuario + refresh_token (session scope)
  db_session      — sesión SQLAlchemy por test; trunca al finalizar (function scope)
  client          — TestClient con DB real; requiere auth_db_engine (function scope)
  client_no_db    — TestClient con DB simulada; corre sin PostgreSQL (function scope)
  rbac_client     — TestClient con ruta protegida /test/socio-only para tests de RBAC
  usuario_socio / usuario_abogado / usuario_inactivo — fixtures de datos sintéticos

Tests de integración (marcados @pytest.mark.integration) requieren que TEST_DATABASE_URL
o DATABASE_URL apunten a una instancia PostgreSQL disponible.
Tests sin DB (CSRF, sin sesión) corren en cualquier entorno.
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import Depends, FastAPI
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
    INACTIVO_EMAIL,
    INACTIVO_NOMBRE,
    INACTIVO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_NOMBRE,
    SOCIO_PASSWORD,
    hash_test_password,
)


# ── Reset del rate limiter entre tests ────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Limpia el estado in-memory del rate limiter antes de cada test.

    Sin esto, los tests de login consumen el límite de 5/min y los tests
    posteriores que también llaman al endpoint de login recibirían 429
    en lugar del status esperado (200/401).

    El reset es best-effort: si la API interna de SlowAPI/limits cambia,
    continúa sin error (los tests de rate limiting se marcan @slow y se
    corren en aislamiento de todas formas).
    """
    try:
        # SlowAPI usa limits.strategies.*RateLimiter con un _storage interno
        storage = _rate_limiter._limiter._storage
        # limits.storage.MemoryStorage expone reset() o _storage dict
        if hasattr(storage, "reset"):
            storage.reset()
        elif hasattr(storage, "_storage") and isinstance(storage._storage, dict):
            storage._storage.clear()
    except Exception:
        pass  # API interna puede cambiar; silencioso
    yield


# ── Engine con tablas de auth ──────────────────────────────────────────────────


@pytest.fixture(scope="session")
def auth_db_engine(db_url):  # db_url viene del conftest.py raíz; skips si no hay DB
    """Engine con las tablas usuario + refresh_token creadas (si no existen).

    Crea enums y tablas con bloques IF NOT EXISTS / DO para ser idempotente.
    Trunca los datos al finalizar la sesión de tests (conserva el esquema).
    """
    engine = create_engine(db_url)

    with engine.begin() as conn:
        # Enums — PostgreSQL no tiene CREATE TYPE IF NOT EXISTS
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
                id          SERIAL PRIMARY KEY,
                email       VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                nombre      VARCHAR(120) NOT NULL,
                rol         rol_usuario NOT NULL,
                area        area_derecho,
                matricula   VARCHAR(50),
                activo      BOOLEAN NOT NULL DEFAULT true,
                creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
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

    yield engine

    with engine.begin() as conn:
        conn.execute(
            text("TRUNCATE refresh_token, usuario RESTART IDENTITY CASCADE")
        )
    engine.dispose()


# ── Sesión por test ────────────────────────────────────────────────────────────


@pytest.fixture
def db_session(auth_db_engine) -> Session:
    """Sesión SQLAlchemy para un test individual.

    Trunca refresh_token y usuario al finalizar para dejar el estado limpio.
    """
    SessionFactory = sessionmaker(
        bind=auth_db_engine,
        autocommit=False,
        autoflush=False,
    )
    session = SessionFactory()

    yield session

    session.close()
    with auth_db_engine.begin() as conn:
        conn.execute(
            text("TRUNCATE refresh_token, usuario RESTART IDENTITY CASCADE")
        )


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
    """Usuario ABOGADO activo con contraseña conocida."""
    from app.features.auth.models import Usuario
    from app.shared.enums import RolUsuario

    user = Usuario(
        email=ABOGADO_EMAIL,
        password_hash=hash_test_password(ABOGADO_PASSWORD),
        nombre=ABOGADO_NOMBRE,
        rol=RolUsuario.ABOGADO,
        activo=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def usuario_inactivo(db_session: Session):
    """Usuario ABOGADO inactivo (activo=False) con contraseña conocida."""
    from app.features.auth.models import Usuario
    from app.shared.enums import RolUsuario

    user = Usuario(
        email=INACTIVO_EMAIL,
        password_hash=hash_test_password(INACTIVO_PASSWORD),
        nombre=INACTIVO_NOMBRE,
        rol=RolUsuario.ABOGADO,
        activo=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ── Apps de test ───────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def _test_app_with_protected_route():
    """FastAPI app con ruta /api/v1/test/socio-only protegida con require_socio.

    Creada una sola vez por sesión de tests. Los overrides de dependencias
    se configuran en rbac_client (function scope).
    """
    from app.core.dependencies import require_socio
    from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
    from app.core.rate_limit import limiter
    from app.features.auth.router import router as auth_router

    _app = FastAPI(title="Iuris Test App")
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _app.add_middleware(SecurityHeadersMiddleware)
    _app.add_middleware(CSRFMiddleware)
    _app.include_router(auth_router, prefix="/api/v1")

    @_app.get("/health")
    def _health():
        return {"status": "UP"}

    @_app.get("/api/v1/test/socio-only", dependencies=[Depends(require_socio)])
    def _protected_socio():
        return {"ok": True}

    return _app


# ── Clientes de test ───────────────────────────────────────────────────────────


@pytest.fixture
def client(db_session: Session, _test_app_with_protected_route):
    """TestClient con DB real sobreescrita.

    Requiere PostgreSQL (heredado de db_session → auth_db_engine → db_url).
    """
    from app.core.dependencies import get_db

    def override_get_db():
        yield db_session

    _test_app_with_protected_route.dependency_overrides[get_db] = override_get_db
    with TestClient(_test_app_with_protected_route, raise_server_exceptions=False) as c:
        yield c
    _test_app_with_protected_route.dependency_overrides.clear()


@pytest.fixture
def client_no_db(_test_app_with_protected_route):
    """TestClient con DB simulada (MagicMock).

    No requiere PostgreSQL — para tests de middleware y rutas que retornan
    antes de consultar la DB (p. ej. CSRF 403, auth 401 sin cookie).
    """
    from app.core.dependencies import get_db

    def override_get_db():
        yield MagicMock(spec=Session)

    _test_app_with_protected_route.dependency_overrides[get_db] = override_get_db
    with TestClient(_test_app_with_protected_route, raise_server_exceptions=False) as c:
        yield c
    _test_app_with_protected_route.dependency_overrides.clear()


@pytest.fixture
def rbac_client(db_session: Session, _test_app_with_protected_route):
    """TestClient con DB real para tests de RBAC (ruta /test/socio-only)."""
    from app.core.dependencies import get_db

    def override_get_db():
        yield db_session

    _test_app_with_protected_route.dependency_overrides[get_db] = override_get_db
    with TestClient(_test_app_with_protected_route, raise_server_exceptions=False) as c:
        yield c
    _test_app_with_protected_route.dependency_overrides.clear()
