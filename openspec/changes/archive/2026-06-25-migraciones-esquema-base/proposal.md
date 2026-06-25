## Why

El esqueleto de la plataforma (RNF-07) ya levanta los cuatro servicios, pero PostgreSQL arranca **vacío**: no hay tablas ni mecanismo de evolución del esquema. Ninguna feature de negocio (auth, clientes, casos, etc.) puede persistir nada hasta que exista el esquema base y una herramienta de migraciones versionada. Este change materializa el esquema canónico del modelo de datos v2 (`docs/03-arquitectura/modelo-de-datos.dbml`) e instala **Alembic + SQLAlchemy** como la única vía de evolución del esquema (RNF-09, regla de `backend/CLAUDE.md`: "Migraciones con Alembic — nada manual en producción").

## What Changes

- **Integración de SQLAlchemy + Alembic en el backend feature-first (ADR-0009).** Se agrega la infraestructura de persistencia transversal en `core/` (engine, `SessionLocal`, `Base` declarativa con `metadata` central y convención de nombres de constraints/índices) y la carpeta `backend/alembic/` (entorno de migraciones, `env.py`, `script.py.mako`, `versions/`) más `alembic.ini`.
- **Modelos ORM por feature (vertical slice).** Cada tabla del DBML v2 se declara como modelo SQLAlchemy dentro de la feature que le corresponde (`features/<feature>/models.py`), importando la `Base` central. Un módulo agregador en `core/` garantiza que `Alembic` "vea" todos los modelos al autogenerar/validar.
- **Migración inicial que materializa el esquema DBML v2.** Una primera revisión de Alembic crea **todas** las tablas, enums, claves foráneas, índices y unicidades del modelo: acceso (`usuario`, `refresh_token`), núcleo (`cliente`, `caso`, `ficha_laboral`), ciclo de vida como datos (`etapa`, `transicion_etapa`, `historial_caso`), operatoria (`telegrama`, `documento`, `vencimiento`, `comunicacion`) e infraestructura (`backup`), con sus 8 enums Postgres.
- **Ejecución de migraciones en el flujo Docker y local.** Se define cómo y cuándo corre `alembic upgrade head` (entrypoint/comando del servicio backend en `docker compose`, y comando documentado para local), reutilizando `DATABASE_URL` del `.env` ya existente.
- **Dependencias nuevas del backend** en `backend/requirements.txt`: `sqlalchemy`, `alembic` y el driver `psycopg2-binary` (o `psycopg`).
- **Health check sin cambios obligatorios.** Se mantiene `GET /health` superficial (no se acopla a la DB en este change); un health "profundo" queda como posible mejora futura.

Fuera de alcance (changes posteriores, NO se tocan aquí):

- **Seed del ciclo de vida (ADR-0008 / RN-04): 18 etapas + 19 transiciones.** Este change deja el **esquema** y Alembic listos, pero NO inserta datos de catálogo. El seed es un change **posterior que requiere el esquema ya migrado** (fila ADR-0008 del changemap; archivos `backend/seeds/seed_etapas.sql` y `etapas_seed_data.py`).
- Cualquier feature de negocio (endpoints, servicios, validaciones de transición, RBAC, CSRF). Aquí solo se declaran los modelos y la estructura de tablas; la lógica vive en sus changes.
- Datos de prueba / base sintética para tests (se define cuando exista una feature que la consuma).

## Capabilities

### New Capabilities
- `esquema-base-datos`: esquema relacional base de PostgreSQL materializado desde el modelo de datos v2 (todas las tablas, enums, FKs, índices y unicidades, incluido el modelo "estados como datos" `etapa`/`transicion_etapa` y el historial inmutable) y el sistema de migraciones Alembic + SQLAlchemy (engine/sesión/`Base` en `core/`, modelos ORM por feature, migración inicial y su ejecución en Docker y local), sin datos de seed.

### Modified Capabilities
<!-- Ninguna. `plataforma-infraestructura` (RNF-07) ya está archivada y sus requisitos no cambian: el esqueleto preveía explícitamente que el esquema llegaba en RNF-09. Este change añade una capability nueva, no modifica requisitos existentes. -->

## Impact

- **Nuevos archivos / directorios**:
  - `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`, `backend/alembic/versions/<rev>_esquema_base_inicial.py`.
  - `backend/app/core/database.py` (engine, `SessionLocal`, dependencia `get_db`), `backend/app/core/db_base.py` (`Base` declarativa + naming convention) y un agregador de modelos (p. ej. `backend/app/core/models_registry.py`) que importa todos los `features/*/models.py`.
  - `backend/app/features/<feature>/models.py` para cada feature con tablas (auth/usuarios, clientes, casos, telegramas, documentos, vencimientos, comunicaciones, backups).
- **Dependencias**: `sqlalchemy`, `alembic`, driver Postgres (`psycopg2-binary`/`psycopg`) agregados a `backend/requirements.txt`.
- **Sistemas / orquestación**: el servicio `backend` del `docker-compose.yml` corre `alembic upgrade head` antes (o como parte) de arrancar Uvicorn; `DATABASE_URL` se toma del `.env` (sin cambios en `.env.example`). `depends_on: db` ya existente cubre el orden de arranque.
- **APIs**: sin cambios en contratos (`docs/04-api/contratos-api.md` no cambia); no se agregan endpoints.
- **Changemap**: al implementarse, la fila RNF-09 ("Migraciones Alembic + esquema base") pasa a 🟡/✅. Habilita (desbloquea) la fila ADR-0008/RN-04 (seed del ciclo de vida) y todas las features de negocio.
