"""
Fixtures para tests del feature vencimientos.
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
    ABOGADO_PASSWORD,
    hash_test_password,
)

ABOGADO_NOMBRE = "Abogado Venc Test"


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


@pytest.fixture(scope="session")
def venc_db_engine(db_url):
    engine = create_engine(db_url)

    with engine.begin() as conn:
        for enum_ddl in [
            "DO $$ BEGIN CREATE TYPE rol_usuario AS ENUM ('SOCIO', 'ABOGADO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE area_derecho AS ENUM ('LABORAL', 'ART'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE fase_caso AS ENUM ('EXTRAJUDICIAL', 'JUDICIAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
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
            CREATE TABLE IF NOT EXISTS vencimiento (
                id          SERIAL PRIMARY KEY,
                caso_id     INTEGER NOT NULL REFERENCES caso(id),
                descripcion VARCHAR(255) NOT NULL,
                fecha       DATE NOT NULL,
                completado  BOOLEAN NOT NULL DEFAULT false,
                creado_por  INTEGER REFERENCES usuario(id),
                creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))

    yield engine

    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE vencimiento, caso, cliente, refresh_token, usuario, etapa RESTART IDENTITY CASCADE"
        ))
    engine.dispose()


@pytest.fixture
def db_session(venc_db_engine) -> Session:
    factory = sessionmaker(bind=venc_db_engine, autocommit=False, autoflush=False)
    session = factory()
    yield session
    session.close()
    with venc_db_engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE vencimiento, caso, cliente, refresh_token, usuario, etapa RESTART IDENTITY CASCADE"
        ))


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
    db_session.execute(text(
        "INSERT INTO cliente (nombre, dni) VALUES ('Cliente Venc Test', '88888888')"
    ))
    db_session.commit()
    cliente_id = db_session.execute(text("SELECT id FROM cliente WHERE dni='88888888'")).scalar()

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


@pytest.fixture(scope="session")
def _test_app():
    from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
    from app.core.rate_limit import limiter
    from app.features.auth.router import router as auth_router
    from app.features.vencimientos.router import router as vencimientos_router

    _app = FastAPI(title="Iuris Test — Vencimientos")
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _app.add_middleware(SecurityHeadersMiddleware)
    _app.add_middleware(CSRFMiddleware)
    _app.include_router(auth_router, prefix="/api/v1")
    _app.include_router(vencimientos_router, prefix="/api/v1")

    @_app.get("/health")
    def _health():
        return {"status": "UP"}

    return _app


@pytest.fixture
def client(db_session: Session, _test_app):
    from app.core.dependencies import get_db

    def override_get_db():
        yield db_session

    _test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(_test_app, raise_server_exceptions=False) as c:
        yield c
    _test_app.dependency_overrides.clear()


@pytest.fixture
def client_no_db(_test_app):
    from app.core.dependencies import get_db

    def override_get_db():
        yield MagicMock(spec=Session)

    _test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(_test_app, raise_server_exceptions=False) as c:
        yield c
    _test_app.dependency_overrides.clear()
