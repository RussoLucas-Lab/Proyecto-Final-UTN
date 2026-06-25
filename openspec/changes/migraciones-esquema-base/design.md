## Context

Iuris ya tiene su esqueleto (change `esqueleto-plataforma`, RNF-07): `backend/app/` feature-first (`main.py`, `core/`, `shared/`, `features/`), `docker-compose.yml` con `backend`, `db` (`postgres:16`), `frontend` y `n8n`, y `.env.example` con `DATABASE_URL=postgresql://iuris:changeme@db:5432/iuris`. `core/config.py` ya expone `settings.DATABASE_URL` vía pydantic-settings. PostgreSQL levanta **vacío**.

La fuente de verdad del esquema es `docs/03-arquitectura/modelo-de-datos.dbml` (v2) y sus invariantes en `modelo-de-datos.md`. El modelo tiene 13 tablas, 12 enums y la decisión central de **estados como datos** (`etapa`/`transicion_etapa`, ADR-0008) más un **historial inmutable** (`historial_caso`, RN-05/06). `backend/CLAUDE.md` fija las reglas: SQL parametrizado con SQLAlchemy, migraciones con Alembic ("nada manual en producción"), organización feature-first sin carpetas globales `models/`/`services/`/`schemas/` en la raíz de `app/`.

Restricciones que enmarcan el diseño: backend stateless y sin IA; un caso pertenece a un área y su `etapa_actual_id` debe ser de la misma área (se valida en servicio, no a nivel DDL); historial append-only; confidencialidad (sin datos reales en el repo). Las dependencias actuales del backend son mínimas (`fastapi`, `uvicorn`, `pydantic-settings`); no hay ORM ni driver de Postgres todavía.

## Goals / Non-Goals

**Goals:**
- Instalar SQLAlchemy + Alembic respetando la organización feature-first (transversal en `core/`, modelos en `features/*/models.py`).
- Una **única migración inicial** que reproduzca fielmente el DBML v2: 13 tablas, 12 enums, todas las FKs, índices y unicidades (`(area, nombre)` en `etapa`, `(etapa_origen_id, etapa_destino_id)` en `transicion_etapa`, `(caso_id, numero)` en `telegrama`, `unique` en `usuario.email`, `cliente.dni`, `ficha_laboral.caso_id`, `refresh_token.token`).
- Que `alembic upgrade head` deje la DB con el esquema completo, tanto en Docker como en local, usando `DATABASE_URL` del `.env`.
- Dejar el patrón de persistencia listo para que las features siguientes solo agreguen su `models.py` y su revisión de Alembic.

**Non-Goals:**
- **Seed del ciclo de vida (18 etapas, 19 transiciones, ADR-0008/RN-04)**: es un change posterior que depende de este. Aquí no se inserta ningún dato.
- Lógica de negocio / validaciones de transición / endpoints / RBAC / CSRF: viven en los changes de cada feature.
- Health check "profundo" contra la DB (se mantiene el `/health` superficial actual).
- Particionado, tuning de índices más allá del DBML, o datos sintéticos para tests.

## Decisions

**1. Persistencia transversal en `core/`, modelos ORM en cada feature.**
- `core/db_base.py`: define la `Base` declarativa (`DeclarativeBase`) con una **naming convention** de constraints/índices (`ix`/`uq`/`fk`/`pk`/`ck`) en `metadata`, para que Alembic genere nombres deterministas y las futuras migraciones sean estables.
- `core/database.py`: crea el `engine` desde `settings.DATABASE_URL`, el `SessionLocal` (sessionmaker) y la dependencia `get_db()` (FastAPI) — esta última queda disponible para features futuras aunque aún no haya endpoints que la usen.
- Cada tabla se declara en `features/<feature>/models.py` heredando de la `Base` central. Mapeo tabla → feature:
  - `auth/models.py`: `usuario`, `refresh_token` (grupo *acceso*).
  - `clientes/models.py`: `cliente`.
  - `casos/models.py`: `caso`, `ficha_laboral`, `etapa`, `transicion_etapa`, `historial_caso` (núcleo + ciclo de vida; el ciclo de vida es operado por la feature casos).
  - `telegramas/models.py`: `telegrama`. `documentos/models.py`: `documento`. `vencimientos/models.py`: `vencimiento`. `comunicaciones/models.py`: `comunicacion`. `backups/models.py`: `backup`.
- *Alternativa descartada*: un único `core/models.py` con todas las tablas → contradice ADR-0009 (vertical slice) y `backend/CLAUDE.md` (sin carpetas/archivos globales de modelos).

**2. Agregador central de modelos para que Alembic los "vea".**
- Problema: con modelos dispersos por feature, el `target_metadata` de Alembic solo conoce las clases que fueron importadas. Solución: un módulo `core/models_registry.py` (o `core/models/__init__.py`) que importa todos los `features/*/models.py`. El `env.py` de Alembic importa ese agregador y usa `Base.metadata` como `target_metadata`.
- *Alternativa descartada*: importar feature por feature dentro de `env.py` → funciona, pero centralizarlo en un registry evita que el `env.py` tenga que conocer cada feature y reduce el riesgo de olvidar una al autogenerar.

**3. Migración inicial escrita explícitamente (no autogenerada a ciegas).**
- Se genera un esqueleto con `alembic revision` y se escribe la `upgrade()`/`downgrade()` de forma explícita y revisada contra el DBML, creando primero los **enums** Postgres (`sa.Enum(..., name=...)`), luego las tablas en orden de dependencias de FK (acceso → cliente → caso → ficha/etapa → transicion/historial → operatoria/backup), y por último índices/unicidades. `downgrade()` hace el inverso (drop tablas y luego `ENUM ... DROP`).
- Los enums se definen con `create_type` controlado para evitar el doble-create de SQLAlchemy/Alembic. Las FKs reflejan exactamente los `Ref:` del DBML (incluida la 1:1 `ficha_laboral.caso_id`).
- *Por qué explícita*: el autogenerate de Alembic es punto de partida pero suele errar enums, server defaults (`now()`) y nombres; una migración inicial revisada a mano es la base estable del proyecto. *Alternativa descartada*: confiar 100% en autogenerate sin revisión → riesgo de drift silencioso respecto del DBML (la spec es la fuente de verdad).

**4. Tipos y defaults fieles al DBML.**
- PKs `integer [pk, increment]` → `Integer, primary_key=True` (autoincrement). `timestamp default now()` → `server_default=sa.func.now()`. `boolean default true/false` → `server_default`. `numeric(14,2)`, `varchar(n)`, `text`, `date` mapeados 1:1. Enums Postgres nativos con los valores exactos del DBML (`rol_usuario`, `area_derecho`, `fase_caso`, `tipo_reclamo_art`, `resultado_telegrama`, `tipo_comunicacion_telegrama`, `categoria_documento`, `formato_documento`, `tipo_comunicacion`, `estado_comunicacion`, `tipo_backup`, `estado_backup`).
- Las invariantes que el DBML deja a la capa de servicio (etapa de la misma área que el caso, `tipo_reclamo` solo ART, telegrama solo Laboral) **no** se fuerzan con CHECK/triggers en este change: se respetan en los servicios de cada feature (coherente con `modelo-de-datos.md`). El historial inmutable es una política de servicio (append-only), no un constraint DDL.

**5. Driver Postgres: `psycopg2-binary`.**
- Se agrega `psycopg2-binary` por simplicidad de instalación en la imagen slim (sin toolchain de compilación). `DATABASE_URL` usa el esquema `postgresql://` (SQLAlchemy resuelve psycopg2 por defecto), coherente con el `.env.example` actual — **no se cambia** la URL.
- *Alternativa considerada*: `psycopg` (v3) → válido, pero requiere `postgresql+psycopg://` en la URL; se evita para no tocar `.env.example`/`config.py`.

**6. Ejecución de migraciones en Docker: `upgrade head` antes de Uvicorn.**
- El servicio `backend` ejecuta `alembic upgrade head && uvicorn app.main:app ...` (vía un `entrypoint.sh` o el `command` del compose). `depends_on: db` ya existe; se refuerza con `condition: service_healthy` (healthcheck de Postgres) para evitar correr migraciones antes de que la DB acepte conexiones.
- En local: `cd backend && alembic upgrade head` con `DATABASE_URL` apuntando a `localhost:5432` (o el que corresponda).
- `alembic.ini` no hardcodea la URL: el `env.py` la lee de `settings.DATABASE_URL` (pydantic-settings), única fuente, así dev/Docker/local comparten configuración.
- *Alternativa descartada*: un servicio `migrator` de un solo uso en el compose → más limpio conceptualmente, pero añade complejidad innecesaria para el MVP; correr `upgrade head` en el arranque del backend es suficiente y reproducible.

## Risks / Trade-offs

- **[Autogenerate de Alembic produce un esquema que no coincide 1:1 con el DBML (enums, defaults `now()`, nombres de constraint)]** → Mitigación: migración inicial escrita/revisada a mano contra el DBML; naming convention en `metadata`; checklist de tablas/índices/unicidades en `tasks.md`. La spec del DBML manda (regla SDD).
- **[Migración corre antes de que Postgres acepte conexiones en Docker]** → Mitigación: `depends_on: db` con `condition: service_healthy` y healthcheck de Postgres; reintentos en el entrypoint si hiciera falta.
- **[Doble creación de enums (SQLAlchemy `Enum` + Alembic op)]** → Mitigación: controlar `create_type`/`checkfirst` en la migración inicial; probar `upgrade` y `downgrade` en una DB limpia.
- **[Olvidar importar el `models.py` de una feature → tabla ausente del `target_metadata`]** → Mitigación: agregador `core/models_registry.py` que importa todas las features; tarea de verificación que cuenta 13 tablas creadas.
- **[Drift futuro entre modelos ORM y el DBML]** → Mitigación: el DBML sigue siendo la fuente de verdad; cualquier cambio de esquema entra como nueva revisión de Alembic y actualiza el DBML en el mismo PR (regla SDD del `CLAUDE.md` raíz).
- **[Acoplar el seed a este change por conveniencia]** → Riesgo de violar el límite del changemap. Mitigación: el seed queda explícitamente fuera (Non-Goal); este change solo verifica que las tablas `etapa`/`transicion_etapa` existen vacías.

## Migration Plan

1. Greenfield de datos: la DB está vacía, no hay esquema previo ni datos que migrar. Instalar dependencias (`sqlalchemy`, `alembic`, `psycopg2-binary`), inicializar `backend/alembic/`, escribir la revisión inicial.
2. Despliegue: `docker compose up --build` → el servicio `backend` corre `alembic upgrade head` (tras `db` healthy) y luego Uvicorn. En local: `alembic upgrade head`.
3. Verificación: conectarse a la DB y confirmar las 13 tablas, los 12 enums y las unicidades/índices del DBML; `alembic current` muestra la revisión inicial como `head`. `etapa` y `transicion_etapa` existen y están **vacías** (sin seed).
4. Rollback: `alembic downgrade base` (la revisión inicial debe tener un `downgrade()` completo) o `docker compose down -v` para descartar el volumen. Como no hay datos de negocio, el rollback es seguro.

## Open Questions

- ¿Ejecutar `upgrade head` en el `command`/`entrypoint` del backend o introducir un servicio `migrator` dedicado? Decisión por defecto: en el arranque del backend (más simple para el MVP); se puede extraer a un `migrator` si más adelante se separan despliegues.
- ¿`psycopg2-binary` o `psycopg` (v3)? Decisión por defecto: `psycopg2-binary` para no tocar `DATABASE_URL`. Revisar si una feature futura necesita async (entonces `psycopg`/`asyncpg` + `postgresql+...`).
- ¿Conviene materializar las invariantes de área (etapa-misma-área, telegrama-solo-Laboral) como CHECK constraints o dejarlas 100% en servicio? Por ahora en servicio (coherente con `modelo-de-datos.md`); reevaluar si aparecen inconsistencias de datos.
