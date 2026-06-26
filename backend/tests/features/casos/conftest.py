"""
Fixtures para tests del feature casos.

Estructura:
  casos_db_engine — engine con todas las tablas necesarias (session scope)
  db_session      — sesión SQLAlchemy por test; trunca al finalizar (function scope)
  client          — TestClient con app completa + DB real (function scope)
  client_no_db    — TestClient con DB simulada, para tests sin PostgreSQL (function scope)
  usuario_socio   — SOCIO activo insertado en DB
  usuario_abogado — ABOGADO activo insertado en DB
  cliente_sintetico — Cliente insertado en DB (base sintética, Ley 25.326)

El catálogo de etapas/transiciones se siembra una vez por sesión de tests
reutilizando etapas_seed_data.seed(engine).

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

# ── Datos sintéticos (base sintética, Ley 25.326) ─────────────────────────────

CLIENTE_SINTETICO = {
    "nombre": "Ramírez Torres, Luis",
    "dni": "30111222",
    "cuil": "20-30111222-5",
    "telefono": "0264-4123456",
    "email": "l.ramirez@iuris.test",
    "domicilio_real": "Calle Sarmiento 567",
    "domicilio_real_cp": "5400",
    "domicilio_real_localidad": "San Juan",
    "domicilio_real_provincia": "San Juan",
    "domicilio_coincide_dni": False,
}

CASO_LABORAL = {
    "cliente_id": 1,        # id dinámico, se sobreescribe en fixtures
    "abogado_responsable_id": 1,
    "area": "LABORAL",
    "tipo_reclamo": None,
    "codigo_expediente": "EXP-TEST-0001",
    "observaciones": "Caso de prueba (base sintética)",
}

CASO_ART = {
    "cliente_id": 1,
    "abogado_responsable_id": 1,
    "area": "ART",
    "tipo_reclamo": "ACCIDENTE",
    "codigo_expediente": "EXP-TEST-0002",
}

FICHA_DATOS = {
    "empleador_nombre": "Empresa Test S.A.",
    "ramo_actividad": "Construcción",
    "direccion_trabajo": "Av. Siempre Viva 742",
    "direccion_trabajo_localidad": "San Juan",
    "jornada": "Tiempo completo",
    "remuneracion": "85000.00",
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
def casos_db_engine(db_url):
    """Engine con todas las tablas del feature casos + sus dependencias.

    Crea enums y tablas de forma idempotente.
    Siembra el catálogo de etapas/transiciones una sola vez por sesión.
    """
    from seeds.etapas_seed_data import seed  # noqa: E402

    engine = create_engine(db_url)

    with engine.begin() as conn:
        # ── Enums ──────────────────────────────────────────────────────────
        for tipo, valores in [
            ("rol_usuario", "('SOCIO', 'ABOGADO')"),
            ("area_derecho", "('LABORAL', 'ART')"),
            ("tipo_reclamo_art", "('ACCIDENTE', 'ENFERMEDAD')"),
            ("fase_caso", "('EXTRAJUDICIAL', 'JUDICIAL')"),
        ]:
            conn.execute(
                text(f"""
                    DO $$ BEGIN
                        CREATE TYPE {tipo} AS ENUM {valores};
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END $$
                """)
            )

        # ── Tablas ─────────────────────────────────────────────────────────
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
            CREATE TABLE IF NOT EXISTS transicion_etapa (
                id                SERIAL PRIMARY KEY,
                etapa_origen_id   INTEGER NOT NULL REFERENCES etapa(id),
                etapa_destino_id  INTEGER NOT NULL REFERENCES etapa(id),
                CONSTRAINT uq_transicion_etapa_etapa_origen_id_etapa_destino_id
                    UNIQUE (etapa_origen_id, etapa_destino_id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS caso (
                id                      SERIAL PRIMARY KEY,
                cliente_id              INTEGER NOT NULL REFERENCES cliente(id),
                abogado_responsable_id  INTEGER NOT NULL REFERENCES usuario(id),
                area                    area_derecho NOT NULL,
                tipo_reclamo            tipo_reclamo_art,
                codigo_expediente       VARCHAR(50),
                etapa_actual_id         INTEGER NOT NULL REFERENCES etapa(id),
                fecha_inicio            DATE,
                observaciones           TEXT,
                creado_en               TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ficha_laboral (
                id                           SERIAL PRIMARY KEY,
                caso_id                      INTEGER NOT NULL UNIQUE REFERENCES caso(id),
                empleador_nombre             VARCHAR(160),
                ramo_actividad               VARCHAR(160),
                direccion_trabajo            VARCHAR(255),
                direccion_trabajo_cp         VARCHAR(20),
                direccion_trabajo_localidad  VARCHAR(120),
                direccion_trabajo_provincia  VARCHAR(120),
                razon_social                 VARCHAR(160),
                motivo_cese                  VARCHAR(255),
                fecha_inicio_laboral         DATE,
                jornada                      VARCHAR(120),
                tareas                       TEXT,
                remuneracion                 NUMERIC(14, 2),
                cct_aplicable                VARCHAR(120),
                registrado                   BOOLEAN,
                fecha_alta                   DATE,
                sueldo_coincide_bono         BOOLEAN,
                jornada_coincide_bono        BOOLEAN,
                estado_aportes               VARCHAR(255),
                accidentes                   TEXT,
                enfermedades                 TEXT,
                notas                        TEXT
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS historial_caso (
                id                SERIAL PRIMARY KEY,
                caso_id           INTEGER NOT NULL REFERENCES caso(id),
                etapa_anterior_id INTEGER REFERENCES etapa(id),
                etapa_nueva_id    INTEGER NOT NULL REFERENCES etapa(id),
                evento            VARCHAR(255) NOT NULL,
                autor_id          INTEGER NOT NULL REFERENCES usuario(id),
                ocurrido_en       TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))

    # Sembrar catálogo de etapas/transiciones (una sola vez por sesión, idempotente)
    seed(engine)

    yield engine

    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE historial_caso, ficha_laboral, caso, transicion_etapa, etapa, "
            "cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
        ))
    engine.dispose()


# ── Sesión por test ────────────────────────────────────────────────────────────


@pytest.fixture
def db_session(casos_db_engine) -> Session:
    """Sesión SQLAlchemy para un test individual. Trunca datos al finalizar."""
    SessionFactory = sessionmaker(
        bind=casos_db_engine,
        autocommit=False,
        autoflush=False,
    )
    session = SessionFactory()
    yield session
    session.close()
    with casos_db_engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE historial_caso, ficha_laboral, caso, "
            "cliente, refresh_token, usuario RESTART IDENTITY CASCADE"
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


@pytest.fixture
def cliente_sintetico(db_session: Session):
    """Cliente sintético para uso en tests (Ley 25.326 — sin datos reales)."""
    from app.features.clientes.models import Cliente

    cliente = Cliente(
        nombre=CLIENTE_SINTETICO["nombre"],
        dni=CLIENTE_SINTETICO["dni"],
        cuil=CLIENTE_SINTETICO["cuil"],
        telefono=CLIENTE_SINTETICO["telefono"],
        email=CLIENTE_SINTETICO["email"],
        domicilio_real=CLIENTE_SINTETICO["domicilio_real"],
        domicilio_real_cp=CLIENTE_SINTETICO["domicilio_real_cp"],
        domicilio_real_localidad=CLIENTE_SINTETICO["domicilio_real_localidad"],
        domicilio_real_provincia=CLIENTE_SINTETICO["domicilio_real_provincia"],
        domicilio_coincide_dni=CLIENTE_SINTETICO["domicilio_coincide_dni"],
    )
    db_session.add(cliente)
    db_session.commit()
    db_session.refresh(cliente)
    return cliente


# ── App de test ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def _test_app():
    """App FastAPI de test con routers de auth, usuarios, clientes y casos."""
    from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
    from app.core.rate_limit import limiter
    from app.features.auth.router import router as auth_router
    from app.features.casos.router import router as casos_router
    from app.features.clientes.router import router as clientes_router
    from app.features.usuarios.router import router as usuarios_router

    _app = FastAPI(title="Iuris Test — Casos")
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _app.add_middleware(SecurityHeadersMiddleware)
    _app.add_middleware(CSRFMiddleware)
    _app.include_router(auth_router, prefix="/api/v1")
    _app.include_router(usuarios_router, prefix="/api/v1")
    _app.include_router(clientes_router, prefix="/api/v1")
    _app.include_router(casos_router, prefix="/api/v1")

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
