"""
Fixtures para tests de la feature comunicaciones.

Estructura:
  comunicaciones_db_engine — engine con todas las tablas necesarias (session scope)
  db_session               — sesión SQLAlchemy por test; trunca al finalizar
  usuario_abogado          — ABOGADO activo
  usuario_socio            — SOCIO activo
  etapa_fixture            — etapa sintética LABORAL
  caso_fixture             — caso sintético vinculado a cliente + abogado + etapa
  client                   — TestClient con dependency_overrides de get_db
  client_no_db             — TestClient con DB simulada (para 401/403 sin PostgreSQL)
  mock_n8n_ok              — monkeypatch httpx.AsyncClient para simular n8n exitoso
  mock_n8n_down            — monkeypatch httpx.AsyncClient para simular n8n caído

Tests de integración (@pytest.mark.integration) requieren TEST_DATABASE_URL o DATABASE_URL.
Tests sin DB (401/403) usan client_no_db y corren en cualquier entorno.
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

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
def comunicaciones_db_engine(db_url):
    engine = create_engine(db_url)

    with engine.begin() as conn:
        for tipo, valores in [
            ("rol_usuario", "('SOCIO', 'ABOGADO')"),
            ("area_derecho", "('LABORAL', 'ART')"),
            ("fase_caso", "('EXTRAJUDICIAL', 'JUDICIAL')"),
            ("tipo_reclamo_art", "('ACCIDENTE', 'ENFERMEDAD')"),
            ("tipo_comunicacion", "('ACTUALIZACION_AUTOMATICA', 'MANUAL')"),
            ("estado_comunicacion", "('PENDIENTE_REVISION', 'APROBADO', 'DESCARTADO')"),
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
                area          area_derecho,
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
            CREATE TABLE IF NOT EXISTS cliente (
                id                       SERIAL PRIMARY KEY,
                nombre                   VARCHAR(120) NOT NULL,
                dni                      VARCHAR(20) UNIQUE NOT NULL,
                cuil                     VARCHAR(20),
                telefono                 VARCHAR(30),
                email                    VARCHAR(120),
                domicilio_real           VARCHAR(255),
                domicilio_real_cp        VARCHAR(20),
                domicilio_real_localidad VARCHAR(120),
                domicilio_real_provincia VARCHAR(120),
                domicilio_coincide_dni   BOOLEAN,
                creado_en                TIMESTAMP NOT NULL DEFAULT NOW()
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
                CONSTRAINT uq_etapa_area_nombre_com UNIQUE (area, nombre)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS transicion_etapa (
                id               SERIAL PRIMARY KEY,
                etapa_origen_id  INTEGER NOT NULL REFERENCES etapa(id),
                etapa_destino_id INTEGER NOT NULL REFERENCES etapa(id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS caso (
                id                     SERIAL PRIMARY KEY,
                cliente_id             INTEGER NOT NULL REFERENCES cliente(id),
                abogado_responsable_id INTEGER NOT NULL REFERENCES usuario(id),
                area                   area_derecho NOT NULL,
                tipo_reclamo           tipo_reclamo_art,
                codigo_expediente      VARCHAR(50),
                etapa_actual_id        INTEGER NOT NULL REFERENCES etapa(id),
                fecha_inicio           DATE,
                observaciones          TEXT,
                creado_en              TIMESTAMP NOT NULL DEFAULT NOW()
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
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS comunicacion (
                id           SERIAL PRIMARY KEY,
                caso_id      INTEGER NOT NULL REFERENCES caso(id),
                contenido    TEXT NOT NULL,
                tipo         tipo_comunicacion NOT NULL,
                estado       estado_comunicacion NOT NULL DEFAULT 'PENDIENTE_REVISION',
                generado_en  TIMESTAMP NOT NULL DEFAULT NOW(),
                aprobado_por INTEGER REFERENCES usuario(id),
                aprobado_en  TIMESTAMP
            )
        """))

    yield engine

    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE comunicacion, vencimiento, caso, transicion_etapa, etapa, "
            "cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
        ))
    engine.dispose()


# ── Sesión por test ────────────────────────────────────────────────────────────


@pytest.fixture
def db_session(comunicaciones_db_engine) -> Session:
    SessionFactory = sessionmaker(
        bind=comunicaciones_db_engine,
        autocommit=False,
        autoflush=False,
    )
    session = SessionFactory()
    yield session
    session.close()
    with comunicaciones_db_engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE comunicacion, vencimiento, caso, "
            "cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
        ))


# ── Fixtures de datos ─────────────────────────────────────────────────────────


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
def etapa_fixture(db_session: Session):
    from app.features.casos.models import Etapa
    from app.shared.enums import AreaDerecho, FaseCaso

    etapa = Etapa(
        area=AreaDerecho.LABORAL,
        fase=FaseCaso.EXTRAJUDICIAL,
        nombre="Consulta inicial",
        orden=1,
        es_terminal=False,
    )
    db_session.add(etapa)
    db_session.commit()
    db_session.refresh(etapa)
    return etapa


@pytest.fixture
def caso_fixture(db_session: Session, usuario_abogado, etapa_fixture):
    from app.features.casos.models import Caso
    from app.features.clientes.models import Cliente
    from app.shared.enums import AreaDerecho

    cliente = Cliente(
        nombre="González, Mario",
        dni="28111999",
        cuil="20-28111999-3",
    )
    db_session.add(cliente)
    db_session.commit()
    db_session.refresh(cliente)

    caso = Caso(
        cliente_id=cliente.id,
        abogado_responsable_id=usuario_abogado.id,
        area=AreaDerecho.LABORAL,
        etapa_actual_id=etapa_fixture.id,
        codigo_expediente="EXP-TEST-COM-001",
    )
    db_session.add(caso)
    db_session.commit()
    db_session.refresh(caso)
    return caso


@pytest.fixture
def comunicacion_fixture(db_session: Session, caso_fixture):
    from app.features.comunicaciones.models import Comunicacion
    from app.shared.enums import EstadoComunicacion, TipoComunicacion

    com = Comunicacion(
        caso_id=caso_fixture.id,
        contenido="Borrador de prueba.",
        tipo=TipoComunicacion.MANUAL,
        estado=EstadoComunicacion.PENDIENTE_REVISION,
    )
    db_session.add(com)
    db_session.commit()
    db_session.refresh(com)
    return com


# ── App de test ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def _test_app():
    from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
    from app.core.rate_limit import limiter
    from app.features.auth.router import router as auth_router
    from app.features.comunicaciones.router import router as com_router

    _app = FastAPI(title="Iuris Test — Comunicaciones")
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _app.add_middleware(SecurityHeadersMiddleware)
    _app.add_middleware(CSRFMiddleware)
    _app.include_router(auth_router, prefix="/api/v1")
    _app.include_router(com_router, prefix="/api/v1")

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


# ── Mocks de n8n ──────────────────────────────────────────────────────────────


def _fake_async_client(post_return=None, post_side_effect=None):
    """Doble de httpx.AsyncClient usable como 'async with httpx.AsyncClient(...) as client'."""
    client = MagicMock()
    client.post = AsyncMock(return_value=post_return, side_effect=post_side_effect)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


@pytest.fixture
def mock_n8n_ok():
    """Monkeypatch de httpx.AsyncClient: simula n8n respondiendo con un borrador."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"borrador": "Estimado cliente, su caso ha avanzado."}
    mock_response.raise_for_status = MagicMock()

    fake_client = _fake_async_client(post_return=mock_response)
    with patch(
        "app.features.comunicaciones.service.httpx.AsyncClient",
        return_value=fake_client,
    ) as m:
        yield m


@pytest.fixture
def mock_n8n_down():
    """Monkeypatch de httpx.AsyncClient: simula n8n caído (ConnectError)."""
    import httpx as _httpx

    fake_client = _fake_async_client(post_side_effect=_httpx.ConnectError("Connection refused"))
    with patch(
        "app.features.comunicaciones.service.httpx.AsyncClient",
        return_value=fake_client,
    ) as m:
        yield m
