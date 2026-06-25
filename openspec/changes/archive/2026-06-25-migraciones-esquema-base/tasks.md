## 1. Dependencias de persistencia

- [x] 1.1 Agregar a `backend/requirements.txt`: `sqlalchemy`, `alembic` y el driver `psycopg2-binary` (versiones pinneadas)
- [x] 1.2 Reconstruir/instalar dependencias y verificar que `import sqlalchemy`, `import alembic` y `import psycopg2` funcionan en el entorno del backend

## 2. Infraestructura de persistencia transversal (core/)

- [x] 2.1 Crear `backend/app/core/db_base.py` con la `Base` declarativa (`DeclarativeBase`) y una naming convention para `ix`/`uq`/`fk`/`pk`/`ck` en `metadata`
- [x] 2.2 Crear `backend/app/core/database.py` con el `engine` (desde `settings.DATABASE_URL`), `SessionLocal` (sessionmaker) y la dependencia `get_db()`
- [x] 2.3 Crear el agregador central de modelos (`backend/app/core/models_registry.py`) que importe todos los `features/*/models.py`, garantizando que queden registrados en `Base.metadata`
- [x] 2.4 Verificar que NO se crean carpetas/archivos globales `models/` en la raíz de `app/` (ADR-0009)

## 3. Modelos ORM por feature (DBML v2)

- [x] 3.1 `features/auth/models.py`: `usuario` (unique `email`) y `refresh_token` (unique `token`, índice `usuario_id`) — grupo acceso
- [x] 3.2 `features/clientes/models.py`: `cliente` (unique `dni`, campos de domicilio CP/Localidad/Provincia)
- [x] 3.3 `features/casos/models.py`: `caso` (índices area/abogado/cliente/etapa/codigo_expediente) y `ficha_laboral` (unique `caso_id`, 1:1)
- [x] 3.4 `features/casos/models.py`: ciclo de vida `etapa` (unique `(area, nombre)`, índice `(area, orden)`, `es_terminal`), `transicion_etapa` (unique `(etapa_origen_id, etapa_destino_id)`) y `historial_caso` (índice `caso_id`, append-only por política de servicio)
- [x] 3.5 `features/telegramas/models.py`: `telegrama` (unique `(caso_id, numero)`) y `features/documentos/models.py`: `documento`
- [x] 3.6 `features/vencimientos/models.py`: `vencimiento` (índice `fecha`) y `features/comunicaciones/models.py`: `comunicacion` (índices `caso_id`, `estado`)
- [x] 3.7 `features/backups/models.py`: `backup`
- [x] 3.8 Declarar los 12 enums Postgres con los valores exactos del DBML y mapear tipos/defaults fieles (`server_default=now()`, `numeric(14,2)`, `varchar(n)`, `boolean default`, PK autoincrement)
- [x] 3.9 Declarar todas las FKs del DBML (incluidas las de `caso`, `historial_caso`, `transicion_etapa` y la 1:1 de `ficha_laboral`)

## 4. Inicialización de Alembic

- [x] 4.1 Ejecutar `alembic init alembic` dentro de `backend/` y mover/ajustar a `backend/alembic/` + `backend/alembic.ini`
- [x] 4.2 Configurar `alembic/env.py` para leer la URL desde `settings.DATABASE_URL` (sin hardcodear en `alembic.ini`) e importar el agregador de modelos, usando `Base.metadata` como `target_metadata`
- [x] 4.3 Ajustar `script.py.mako` si hace falta (convención de nombres de archivo de revisión)

## 5. Migración inicial (esquema base, sin seed)

- [x] 5.1 Generar la revisión inicial (`alembic revision -m "esquema base inicial"`) y escribir `upgrade()`/`downgrade()` revisados contra el DBML
- [x] 5.2 En `upgrade()`: crear primero los enums, luego las 13 tablas en orden de dependencias de FK, después índices y unicidades
- [x] 5.3 En `downgrade()`: drop de tablas en orden inverso y luego `DROP TYPE` de los enums; controlar `create_type`/`checkfirst` para evitar doble-create
- [x] 5.4 Confirmar explícitamente que la migración NO inserta etapas, transiciones ni ningún dato de seed (queda para el change posterior ADR-0008/RN-04)

## 6. Ejecución en Docker y local

- [x] 6.1 Hacer que el servicio `backend` del `docker-compose.yml` corra `alembic upgrade head` antes de Uvicorn (vía `entrypoint.sh` o `command`)
- [x] 6.2 Asegurar el orden de arranque: `depends_on: db` con `condition: service_healthy` (healthcheck de Postgres)
- [x] 6.3 Documentar el comando local (`cd backend && alembic upgrade head` con `DATABASE_URL` apuntando a la DB)

## 7. Verificación

- [x] 7.1 Sobre una DB limpia, ejecutar `alembic upgrade head` y confirmar las 13 tablas, los 12 enums y todas las unicidades/índices del DBML; `alembic current` muestra la revisión como `head`
- [x] 7.2 Confirmar que `etapa`, `transicion_etapa` e `historial_caso` existen y están **vacías**
- [x] 7.3 Ejecutar `alembic downgrade base` y confirmar que se eliminan tablas y enums sin intervención manual
- [x] 7.4 Verificar el flujo completo con `docker compose up --build`: migraciones aplicadas automáticamente y backend saludable (`GET /health` → `{"status":"UP"}`)
- [x] 7.5 Actualizar la fila RNF-09 del `docs/changemap.md` (estado + Rama/PR) y agregar una línea al changelog
