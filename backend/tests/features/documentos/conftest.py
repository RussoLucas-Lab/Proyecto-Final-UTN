"""
Fixtures para tests del feature documentos.

Tests de integración (@pytest.mark.integration) requieren TEST_DATABASE_URL o DATABASE_URL.
Tests sin DB (CSRF, sin sesión) usan client_no_db y corren sin PostgreSQL.
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
from app.core.storage import StorageClient, get_storage_client
from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_PASSWORD,
    hash_test_password,
)

ABOGADO_NOMBRE = "Abogado Docs Test"
SOCIO_NOMBRE = "Socio Docs Test"


# ── Reset rate limiter ─────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    try:
        storage = _rate_limiter._limiter._storage
        if hasattr(storage, "reset"):
            storage.reset()
        elif hasattr(storage, "_storage") and isinstance(storage._storage, dict):
            storage._storage.clear()
    except Exception:
        pass
    yield


# ── StorageClient mock ─────────────────────────────────────────────────────────


@pytest.fixture
def mock_storage():
    s = MagicMock(spec=StorageClient)
    s.generate_presigned_url.return_value = "https://signed.example.com/key"
    return s


# ── Engine con tablas necesarias ──────────────────────────────────────────────


@pytest.fixture(scope="session")
def docs_db_engine(db_url):
    engine = create_engine(db_url)

    with engine.begin() as conn:
        for enum_ddl in [
            "DO $$ BEGIN CREATE TYPE rol_usuario AS ENUM ('SOCIO', 'ABOGADO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE area_derecho AS ENUM ('LABORAL', 'ART'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE fase_caso AS ENUM ('EXTRAJUDICIAL', 'JUDICIAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE categoria_documento AS ENUM ('DNI','BONO_SUELDO','HISTORIA_CLINICA','ACTA_NOTARIAL','PODER','OTRO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE formato_documento AS ENUM ('PDF','DOC','IMAGEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
        ]:
            conn.execute(text(enum_ddl))

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
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS refresh_token (
                id         SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuario(id),
                token      VARCHAR(255) UNIQUE NOT NULL,
                issued_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL,
                revoked    BOOLEAN NOT NULL DEFAULT false
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cliente (
                id        SERIAL PRIMARY KEY,
                nombre    VARCHAR(120) NOT NULL,
                dni       VARCHAR(20) UNIQUE NOT NULL,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS etapa (
                id          SERIAL PRIMARY KEY,
                area        area_derecho NOT NULL,
                fase        fase_caso NOT NULL,
                nombre      VARCHAR(80) NOT NULL,
                orden       INTEGER NOT NULL,
                es_terminal BOOLEAN NOT NULL DEFAULT false,
                CONSTRAINT uq_etapa_area_nombre UNIQUE (area, nombre)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS caso (
                id                      SERIAL PRIMARY KEY,
                cliente_id              INTEGER NOT NULL REFERENCES cliente(id),
                abogado_responsable_id  INTEGER NOT NULL REFERENCES usuario(id),
                area                    area_derecho NOT NULL,
                etapa_actual_id         INTEGER REFERENCES etapa(id),
                fecha_inicio            DATE,
                creado_en               TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS documento (
                id                  SERIAL PRIMARY KEY,
                caso_id             INTEGER NOT NULL REFERENCES caso(id),
                categoria           categoria_documento NOT NULL,
                formato             formato_documento NOT NULL,
                nombre_archivo      VARCHAR(255) NOT NULL,
                ruta_almacenamiento VARCHAR(500) NOT NULL,
                subido_por          INTEGER NOT NULL REFERENCES usuario(id),
                subido_en           TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))

    yield engine

    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE documento, caso, cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
        ))
    engine.dispose()


# ── Sesión por test ────────────────────────────────────────────────────────────


@pytest.fixture
def db_session(docs_db_engine) -> Session:
    factory = sessionmaker(bind=docs_db_engine, autocommit=False, autoflush=False)
    session = factory()
    yield session
    session.close()
    with docs_db_engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE documento, caso, cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
        ))


# ── Datos sintéticos ──────────────────────────────────────────────────────────


@pytest.fixture
def usuario_abogado(db_session: Session):
    from app.features.auth.models import Usuario
    from app.shared.enums import AreaDerecho, RolUsuario

    u = Usuario(
        email=ABOGADO_EMAIL,
        password_hash=hash_test_password(ABOGADO_PASSWORD),
        nombre=ABOGADO_NOMBRE,
        rol=RolUsuario.ABOGADO,
        area=AreaDerecho.LABORAL,
        activo=True,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture
def caso_con_abogado(db_session: Session, usuario_abogado):
    from app.shared.enums import AreaDerecho

    db_session.execute(text(
        "INSERT INTO cliente (nombre, dni) VALUES ('Cliente Test', '99999999')"
    ))
    db_session.commit()
    cliente_id = db_session.execute(text("SELECT id FROM cliente WHERE dni='99999999'")).scalar()

    etapa_id = db_session.execute(text(
        "INSERT INTO etapa (area, fase, nombre, orden) VALUES ('LABORAL','EXTRAJUDICIAL','Admisión',1) RETURNING id"
    )).scalar()
    db_session.commit()

    caso_id = db_session.execute(text(
        "INSERT INTO caso (cliente_id, abogado_responsable_id, area, etapa_actual_id, fecha_inicio) "
        f"VALUES ({cliente_id}, {usuario_abogado.id}, 'LABORAL', {etapa_id}, NOW()) RETURNING id"
    )).scalar()
    db_session.commit()
    return caso_id


# ── App de test ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def _test_app():
    from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
    from app.core.rate_limit import limiter
    from app.features.auth.router import router as auth_router
    from app.features.documentos.router import router as documentos_router

    _app = FastAPI(title="Iuris Test — Documentos")
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _app.add_middleware(SecurityHeadersMiddleware)
    _app.add_middleware(CSRFMiddleware)
    _app.include_router(auth_router, prefix="/api/v1")
    _app.include_router(documentos_router, prefix="/api/v1")

    @_app.get("/health")
    def _health():
        return {"status": "UP"}

    return _app


@pytest.fixture
def client(db_session: Session, _test_app, mock_storage):
    from app.core.dependencies import get_db

    def override_get_db():
        yield db_session

    _test_app.dependency_overrides[get_db] = override_get_db
    _test_app.dependency_overrides[get_storage_client] = lambda: mock_storage
    with TestClient(_test_app, raise_server_exceptions=False) as c:
        yield c
    _test_app.dependency_overrides.clear()


@pytest.fixture
def client_no_db(_test_app, mock_storage):
    from app.core.dependencies import get_db

    def override_get_db():
        yield MagicMock(spec=Session)

    _test_app.dependency_overrides[get_db] = override_get_db
    _test_app.dependency_overrides[get_storage_client] = lambda: mock_storage
    with TestClient(_test_app, raise_server_exceptions=False) as c:
        yield c
    _test_app.dependency_overrides.clear()
