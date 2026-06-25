## ADDED Requirements

### Requirement: Infraestructura de persistencia transversal (SQLAlchemy)

El backend SHALL proveer la infraestructura de persistencia de forma transversal en `core/`: una `Base` declarativa de SQLAlchemy con convención de nombres de constraints e índices, un `engine` y un `SessionLocal` construidos desde `settings.DATABASE_URL`, y una dependencia de sesión reutilizable. Los modelos ORM SHALL declararse por feature (`features/<feature>/models.py`), sin carpetas globales `models/` en la raíz de `app/` (ADR-0009).

#### Scenario: Base declarativa y sesión disponibles en core

- **WHEN** se inspecciona `backend/app/core/`
- **THEN** existe una `Base` declarativa con una naming convention para `ix`/`uq`/`fk`/`pk`/`ck` en su `metadata`
- **AND** existen un `engine` y un `SessionLocal` (sessionmaker) que leen la conexión desde `settings.DATABASE_URL`
- **AND** existe una dependencia de sesión (p. ej. `get_db`) que abre y cierra la sesión por request

#### Scenario: Modelos declarados por feature

- **WHEN** se inspecciona el backend
- **THEN** cada tabla del modelo de datos está declarada como modelo ORM en el `features/<feature>/models.py` que le corresponde, heredando de la `Base` central
- **AND** no existen carpetas/archivos globales `models/` en la raíz de `app/`

#### Scenario: Alembic descubre todos los modelos

- **WHEN** Alembic resuelve su `target_metadata`
- **THEN** un agregador central de `core/` importa todos los `features/*/models.py`, de modo que las 13 tablas del modelo quedan registradas en `Base.metadata`

### Requirement: Sistema de migraciones Alembic

El backend SHALL usar Alembic como única vía de creación y evolución del esquema de la base de datos. La configuración SHALL tomar la URL de conexión desde `settings.DATABASE_URL` (no hardcodeada en `alembic.ini`), y SHALL existir una migración inicial aplicable como `head`.

#### Scenario: Estructura de Alembic presente

- **WHEN** se inspecciona el directorio `backend/`
- **THEN** existen `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako` y el directorio `alembic/versions/`
- **AND** el `env.py` obtiene la URL de conexión desde `settings.DATABASE_URL` y usa `Base.metadata` como `target_metadata`

#### Scenario: upgrade head crea el esquema completo en una DB vacía

- **WHEN** se ejecuta `alembic upgrade head` contra una base PostgreSQL vacía
- **THEN** se crean las 13 tablas del modelo (`usuario`, `refresh_token`, `cliente`, `caso`, `ficha_laboral`, `etapa`, `transicion_etapa`, `historial_caso`, `telegrama`, `documento`, `vencimiento`, `comunicacion`, `backup`)
- **AND** `alembic current` reporta la revisión inicial como `head`

#### Scenario: downgrade revierte la migración inicial

- **WHEN** se ejecuta `alembic downgrade base` tras haber aplicado la migración inicial
- **THEN** se eliminan todas las tablas y los enums creados por la revisión inicial, dejando la base sin el esquema
- **AND** la operación no requiere intervención manual

### Requirement: Esquema base materializado desde el modelo de datos v2

La migración inicial SHALL materializar fielmente el esquema canónico definido en `docs/03-arquitectura/modelo-de-datos.dbml` (v2): todos los enums, claves primarias, claves foráneas, índices y restricciones de unicidad. Si el esquema implementado y el DBML divergen, gana el DBML (regla SDD).

#### Scenario: Enums de Postgres creados

- **WHEN** se inspecciona el esquema tras `upgrade head`
- **THEN** existen los enums `rol_usuario`, `area_derecho`, `fase_caso`, `tipo_reclamo_art`, `resultado_telegrama`, `tipo_comunicacion_telegrama`, `categoria_documento`, `formato_documento`, `tipo_comunicacion`, `estado_comunicacion`, `tipo_backup` y `estado_backup` con los valores definidos en el DBML

#### Scenario: Claves foráneas del modelo presentes

- **WHEN** se inspecciona el esquema tras `upgrade head`
- **THEN** existen las FKs del DBML, incluyendo `caso.cliente_id → cliente.id`, `caso.abogado_responsable_id → usuario.id`, `caso.etapa_actual_id → etapa.id`, `ficha_laboral.caso_id → caso.id` (1:1), `transicion_etapa.etapa_origen_id/etapa_destino_id → etapa.id`, `historial_caso.caso_id/etapa_anterior_id/etapa_nueva_id/autor_id`, y las de `telegrama`, `documento`, `vencimiento`, `comunicacion`, `refresh_token`

#### Scenario: Unicidades e índices del modelo presentes

- **WHEN** se inspecciona el esquema tras `upgrade head`
- **THEN** existen las unicidades `usuario.email`, `cliente.dni`, `ficha_laboral.caso_id`, `refresh_token.token`, `etapa (area, nombre)`, `transicion_etapa (etapa_origen_id, etapa_destino_id)` y `telegrama (caso_id, numero)`
- **AND** existen los índices no únicos definidos en el DBML (p. ej. en `caso`, `etapa (area, orden)`, `historial_caso.caso_id`, `vencimiento.fecha`, `comunicacion (caso_id, estado)`, `refresh_token.usuario_id`)

#### Scenario: Modelo "estados como datos" e historial presentes y vacíos

- **WHEN** se inspecciona el esquema tras `upgrade head`
- **THEN** existen las tablas `etapa`, `transicion_etapa` (ciclo de vida configurable, ADR-0008) y `historial_caso` (bitácora inmutable, RN-05/06)
- **AND** estas tablas están vacías: la migración NO inserta etapas, transiciones ni ningún otro dato de seed

### Requirement: Ejecución de migraciones en Docker y en local

El flujo de despliegue SHALL aplicar las migraciones automáticamente al levantar el stack con `docker compose`, y SHALL ser posible aplicarlas manualmente en un entorno local, reutilizando `DATABASE_URL` del `.env` existente.

#### Scenario: Migraciones se aplican al levantar el stack

- **WHEN** se ejecuta `docker compose up --build`
- **THEN** el servicio `backend` ejecuta `alembic upgrade head` después de que el servicio `db` esté disponible y antes de servir tráfico
- **AND** la base queda con el esquema completo sin pasos manuales adicionales

#### Scenario: Migraciones aplicables en local

- **WHEN** un desarrollador ejecuta `alembic upgrade head` desde `backend/` con `DATABASE_URL` apuntando a su PostgreSQL
- **THEN** el esquema se crea usando la misma configuración de conexión que en Docker, sin URLs hardcodeadas en `alembic.ini`
