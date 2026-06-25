"""
Fixtures globales para tests del backend de Iuris.

La base de datos de test es una PostgreSQL separada (ADR-0004: base
sintética). Requiere que la variable de entorno TEST_DATABASE_URL o
DATABASE_URL apunte a una instancia disponible antes de correr pytest.

Ejemplo:
    DATABASE_URL=postgresql+psycopg2://iuris:changeme@localhost:5432/iuris_test pytest
"""
import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

# Agregar backend/ al sys.path para poder importar desde seeds/ y app/
BACKEND_DIR = Path(__file__).parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture(scope="session")
def db_url() -> str:
    """URL de PostgreSQL para la sesión de tests.

    Lee TEST_DATABASE_URL primero; si no, DATABASE_URL. Si ninguna está
    seteada, los tests que la usen se omiten con skip.
    """
    url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip(
            "Requiere PostgreSQL. Setear TEST_DATABASE_URL o DATABASE_URL. "
            "Ej: DATABASE_URL=postgresql+psycopg2://iuris:changeme@localhost:5432/iuris_test "
            "pytest"
        )
    return url


@pytest.fixture(scope="session")
def db_engine(db_url: str):
    """Engine con el esquema mínimo (etapa + transicion_etapa) para tests de seed.

    Crea los tipos enum y las tablas si no existen. No depende de que
    alembic haya corrido previamente; crea solo lo necesario para validar
    el seed. Limpia los datos al finalizar la sesión de tests.
    """
    engine = create_engine(db_url)

    with engine.begin() as conn:
        # Crear enums: PostgreSQL no tiene CREATE TYPE IF NOT EXISTS,
        # se usa el bloque DO con manejo de excepción.
        conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE area_derecho AS ENUM ('LABORAL', 'ART');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        """))
        conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE fase_caso AS ENUM ('EXTRAJUDICIAL', 'JUDICIAL');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        """))

        # Tabla etapa — columnas y restricciones según migración 001 y ORM
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS etapa (
                id SERIAL PRIMARY KEY,
                area area_derecho NOT NULL,
                fase fase_caso NOT NULL,
                nombre VARCHAR(80) NOT NULL,
                orden INTEGER NOT NULL,
                es_terminal BOOLEAN NOT NULL DEFAULT false,
                CONSTRAINT uq_etapa_area_nombre UNIQUE (area, nombre)
            )
        """))

        # Tabla transicion_etapa — restricción única según migración 001 y ORM
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS transicion_etapa (
                id SERIAL PRIMARY KEY,
                etapa_origen_id INTEGER NOT NULL REFERENCES etapa(id),
                etapa_destino_id INTEGER NOT NULL REFERENCES etapa(id),
                CONSTRAINT uq_transicion_etapa_etapa_origen_id_etapa_destino_id
                    UNIQUE (etapa_origen_id, etapa_destino_id)
            )
        """))

    yield engine

    # Limpiar datos al finalizar (se conserva el esquema para futuras
    # ejecuciones rápidas de los tests)
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE transicion_etapa, etapa RESTART IDENTITY CASCADE"
        ))

    engine.dispose()
