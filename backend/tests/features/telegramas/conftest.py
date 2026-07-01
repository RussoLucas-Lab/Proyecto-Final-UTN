"""
Fixtures para tests de la feature telegramas.

Estructura:
  telegramas_db_engine — engine con todas las tablas necesarias (session scope)
  db_session           — sesión SQLAlchemy por test; trunca al finalizar
  usuario_abogado      — ABOGADO activo
  usuario_socio        — SOCIO activo
  etapa_laboral        — etapa sintética LABORAL
  etapa_art            — etapa sintética ART
  caso_laboral         — caso LABORAL con ficha_laboral y cliente
  caso_art             — caso ART
  telegrama_fixture    — telegrama número 1 en caso_laboral
  client               — TestClient con dependency_overrides de get_db
  client_no_db         — TestClient con DB simulada (para 401/403 sin PostgreSQL)

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
def telegramas_db_engine(db_url):
    engine = create_engine(db_url)

    with engine.begin() as conn:
        # Enums del dominio
        for tipo, valores in [
            ("rol_usuario", "('SOCIO', 'ABOGADO')"),
            ("area_derecho", "('LABORAL', 'ART')"),
            ("fase_caso", "('EXTRAJUDICIAL', 'JUDICIAL')"),
            ("tipo_reclamo_art", "('ACCIDENTE', 'ENFERMEDAD')"),
            (
                "resultado_telegrama",
                "('PENDIENTE', 'ENTREGADO', 'RECHAZADO', 'EN_SUCURSAL', 'DOMICILIO_INEXISTENTE', 'CERRADO')",
            ),
            ("tipo_comunicacion_telegrama", "('RENUNCIA', 'AUSENCIA', 'OTRO')"),
        ]:
            conn.execute(
                text(f"""
                DO $$ BEGIN
                    CREATE TYPE {tipo} AS ENUM {valores};
                EXCEPTION WHEN duplicate_object THEN NULL;
                END $$
            """)
            )

        conn.execute(
            text("""
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
        """)
        )
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS refresh_token (
                id          SERIAL PRIMARY KEY,
                usuario_id  INTEGER NOT NULL REFERENCES usuario(id),
                token       VARCHAR(255) UNIQUE NOT NULL,
                issued_at   TIMESTAMP NOT NULL DEFAULT NOW(),
                expires_at  TIMESTAMP NOT NULL,
                revoked     BOOLEAN NOT NULL DEFAULT false
            )
        """)
        )
        conn.execute(
            text("""
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
        """)
        )
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS etapa (
                id          SERIAL PRIMARY KEY,
                area        area_derecho NOT NULL,
                fase        fase_caso NOT NULL,
                nombre      VARCHAR(80) NOT NULL,
                orden       INTEGER NOT NULL,
                es_terminal BOOLEAN NOT NULL DEFAULT false,
                CONSTRAINT uq_etapa_area_nombre_tel UNIQUE (area, nombre)
            )
        """)
        )
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS transicion_etapa (
                id               SERIAL PRIMARY KEY,
                etapa_origen_id  INTEGER NOT NULL REFERENCES etapa(id),
                etapa_destino_id INTEGER NOT NULL REFERENCES etapa(id)
            )
        """)
        )
        conn.execute(
            text("""
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
        """)
        )
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS ficha_laboral (
                id                          SERIAL PRIMARY KEY,
                caso_id                     INTEGER NOT NULL UNIQUE REFERENCES caso(id),
                empleador_nombre            VARCHAR(160),
                ramo_actividad              VARCHAR(160),
                direccion_trabajo           VARCHAR(255),
                direccion_trabajo_cp        VARCHAR(20),
                direccion_trabajo_localidad VARCHAR(120),
                direccion_trabajo_provincia VARCHAR(120),
                razon_social                VARCHAR(160),
                motivo_cese                 VARCHAR(255),
                fecha_inicio_laboral        DATE,
                jornada                     VARCHAR(120),
                tareas                      TEXT,
                remuneracion                NUMERIC(14,2),
                cct_aplicable               VARCHAR(120),
                registrado                  BOOLEAN,
                fecha_alta                  DATE,
                sueldo_coincide_bono        BOOLEAN,
                jornada_coincide_bono       BOOLEAN,
                estado_aportes              VARCHAR(255),
                accidentes                  TEXT,
                enfermedades                TEXT,
                notas                       TEXT
            )
        """)
        )
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS telegrama (
                id                 SERIAL PRIMARY KEY,
                caso_id            INTEGER NOT NULL REFERENCES caso(id),
                numero             INTEGER NOT NULL,
                resultado          resultado_telegrama NOT NULL DEFAULT 'PENDIENTE',
                tipo_comunicacion  tipo_comunicacion_telegrama NOT NULL DEFAULT 'OTRO',
                destinatario       VARCHAR(160),
                domicilio_destino  VARCHAR(255),
                cuerpo             TEXT,
                codigo_seguimiento VARCHAR(60),
                fecha_envio        DATE,
                fecha_resultado    DATE,
                CONSTRAINT uq_telegrama_caso_id_numero UNIQUE (caso_id, numero)
            )
        """)
        )

    yield engine

    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE telegrama, ficha_laboral, caso, transicion_etapa, etapa, "
                "cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
            )
        )
    engine.dispose()


# ── Sesión por test ────────────────────────────────────────────────────────────


@pytest.fixture
def db_session(telegramas_db_engine) -> Session:
    SessionFactory = sessionmaker(
        bind=telegramas_db_engine,
        autocommit=False,
        autoflush=False,
    )
    session = SessionFactory()
    yield session
    session.close()
    with telegramas_db_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE telegrama, ficha_laboral, caso, transicion_etapa, etapa, "
                "cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
            )
        )


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
def etapa_laboral(db_session: Session):
    from app.features.casos.models import Etapa
    from app.shared.enums import AreaDerecho, FaseCaso

    etapa = Etapa(
        area=AreaDerecho.LABORAL,
        fase=FaseCaso.EXTRAJUDICIAL,
        nombre="Consulta inicial Laboral",
        orden=1,
        es_terminal=False,
    )
    db_session.add(etapa)
    db_session.commit()
    db_session.refresh(etapa)
    return etapa


@pytest.fixture
def etapa_art(db_session: Session):
    from app.features.casos.models import Etapa
    from app.shared.enums import AreaDerecho, FaseCaso

    etapa = Etapa(
        area=AreaDerecho.ART,
        fase=FaseCaso.EXTRAJUDICIAL,
        nombre="Consulta inicial ART",
        orden=1,
        es_terminal=False,
    )
    db_session.add(etapa)
    db_session.commit()
    db_session.refresh(etapa)
    return etapa


@pytest.fixture
def caso_laboral(db_session: Session, usuario_abogado, etapa_laboral):
    """Caso LABORAL con cliente y ficha_laboral sintéticos."""
    from app.features.casos.models import Caso, FichaLaboral
    from app.features.clientes.models import Cliente
    from app.shared.enums import AreaDerecho

    cliente = Cliente(
        nombre="García Rodríguez, Juan",
        dni="28456001",
        domicilio_real="Lavalle 892, piso 3",
        domicilio_real_cp="5500",
        domicilio_real_localidad="Mendoza",
        domicilio_real_provincia="Mendoza",
    )
    db_session.add(cliente)
    db_session.commit()
    db_session.refresh(cliente)

    caso = Caso(
        cliente_id=cliente.id,
        abogado_responsable_id=usuario_abogado.id,
        area=AreaDerecho.LABORAL,
        etapa_actual_id=etapa_laboral.id,
        codigo_expediente="EXP-TEST-TEL-001",
    )
    db_session.add(caso)
    db_session.commit()
    db_session.refresh(caso)

    ficha = FichaLaboral(
        caso_id=caso.id,
        empleador_nombre="Metalúrgica del Oeste S.A.",
        razon_social="Metalúrgica del Oeste S.A.",
        ramo_actividad="Metalurgia",
        direccion_trabajo="Av. San Martín 1450",
        direccion_trabajo_cp="5500",
        direccion_trabajo_localidad="Mendoza",
        direccion_trabajo_provincia="Mendoza",
    )
    db_session.add(ficha)
    db_session.commit()

    return caso


@pytest.fixture
def caso_art(db_session: Session, usuario_abogado, etapa_art):
    """Caso ART — usado para verificar que telegramas solo aplican a LABORAL (RN-15)."""
    from app.features.casos.models import Caso
    from app.features.clientes.models import Cliente
    from app.shared.enums import AreaDerecho, TipoReclamoArt

    cliente = Cliente(
        nombre="Pérez Sosa, María",
        dni="35678002",
    )
    db_session.add(cliente)
    db_session.commit()
    db_session.refresh(cliente)

    caso = Caso(
        cliente_id=cliente.id,
        abogado_responsable_id=usuario_abogado.id,
        area=AreaDerecho.ART,
        tipo_reclamo=TipoReclamoArt.ACCIDENTE,
        etapa_actual_id=etapa_art.id,
        codigo_expediente="EXP-TEST-TEL-ART-001",
    )
    db_session.add(caso)
    db_session.commit()
    db_session.refresh(caso)
    return caso


@pytest.fixture
def telegrama_fixture(db_session: Session, caso_laboral):
    """Telegrama número 1 en caso_laboral — resultado PENDIENTE."""
    from app.features.telegramas.models import Telegrama
    from app.shared.enums import ResultadoTelegrama, TipoComunicacionTelegrama

    tel = Telegrama(
        caso_id=caso_laboral.id,
        numero=1,
        tipo_comunicacion=TipoComunicacionTelegrama.OTRO,
        resultado=ResultadoTelegrama.PENDIENTE,
        destinatario="Metalúrgica del Oeste S.A.",
        domicilio_destino="Av. San Martín 1450",
        cuerpo="Por la presente, intimo a Vuestra Empresa...",
    )
    db_session.add(tel)
    db_session.commit()
    db_session.refresh(tel)
    return tel


# ── App de test ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def _test_app():
    from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
    from app.core.rate_limit import limiter
    from app.features.auth.router import router as auth_router
    from app.features.telegramas.router import router as telegramas_router

    _app = FastAPI(title="Iuris Test — Telegramas")
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _app.add_middleware(SecurityHeadersMiddleware)
    _app.add_middleware(CSRFMiddleware)
    _app.include_router(auth_router, prefix="/api/v1")
    _app.include_router(telegramas_router, prefix="/api/v1")

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
