# CLAUDE.md — Backend (Iuris)

API y lógica de datos en **FastAPI + PostgreSQL**. Rol del servicio: **datos + orquestación**. Persiste, valida sesión/rol, aplica reglas de negocio y **dispara** los workflows de n8n. Specs en `docs/`.

## Regla crítica: SIN IA en el backend

- **No** integres LLMs, SDK de OpenAI, prompts ni claves de modelo.
- La IA ocurre 100% en n8n (AI Agent). El backend solo:
  1. **dispara** webhooks de n8n (validando sesión, rol y secreto compartido), y
  2. expone endpoints de **datos** que el agente consume como herramienta (solo lectura).
- Llamar a un webhook de n8n **no** es "IA en el backend". (ADR-0003)

## Seguridad (obligatoria — ver `docs/07-seguridad-y-despliegue/`)

- **Auth**: JWT **access (15 min) + refresh (7 días)** en **cookies** `HttpOnly`, `Secure`, `SameSite`. El refresh se guarda en la tabla `refresh_token` y es **revocable** (logout/expiración).
- **CSRF** en todas las mutaciones (token o double-submit), porque la auth usa cookies.
- **RBAC**: roles `SOCIO` y `ABOGADO`; cada endpoint valida usuario autenticado + permiso del rol + cuenta activa.
- Contraseñas con **bcrypt/argon2** (nunca texto plano); política mínima de complejidad.
- **SQL parametrizado** siempre (SQLAlchemy); jamás concatenar SQL.
- **Rate limiting** (login ~5/min, API ~100/min, p. ej. SlowAPI), **headers** de seguridad, HTTPS en prod.
- Errores internos **no** se exponen (`{"error":"Internal Server Error"}`); el detalle va a logs. **No** loguear contraseñas, tokens ni datos personales.
- Backend **stateless**; `GET /health` → `{"status":"UP"}`.

## Estructura (feature-first / vertical slice)

El código se organiza **por features**, no por capas. Cada feature es una carpeta autocontenida con su router, lógica, esquemas y modelos. Lo transversal vive en `core/` (y `shared/`). No hay carpetas globales `services/`, `models/` ni `schemas/` en la raíz de `app/`.

```
backend/
  app/
    main.py            # crea la app e incluye el router de cada feature
    core/              # TRANSVERSAL: config/settings, seguridad (JWT, cookies, CSRF),
                       #   sesión de DB, dependencias compartidas, errores, middleware,
                       #   rate limiting, logging
    shared/            # utilidades y modelos base compartidos (opcional)
    features/          # una carpeta por feature, autocontenida
      auth/            # login / refresh / logout + refresh_token
      usuarios/        # gestión de usuarios (SOCIO)
      clientes/        # admisión + CRUD
      casos/           # casos, etapas, transiciones, historial, avanzar/retroceder
      documentos/      # subida/descarga R2 (presigned)
      comunicaciones/  # borradores IA (WF-01/05): persistir, aprobar/descartar
      telegramas/      # registro de telegramas (Ley 23.789)
      vencimientos/    # agenda
      backups/         # historial / manual
  seeds/               # seed_etapas.sql / etapas_seed_data.py
  tests/               # espeja features/ (un paquete de tests por feature)
  alembic/             # migraciones
```

Cada feature contiene típicamente: `router.py` (endpoints, incluidos los `/internal` que le correspondan), `service.py` (lógica de negocio), `schemas.py` (Pydantic), `models.py` (ORM) y `dependencies.py` (dependencias de la feature). Las dependencias entre features se resuelven vía `core/`/`shared/` o interfaces, evitando imports cruzados directos. (ADR-0009)

## Reglas de negocio a respetar (ver `docs/01-requisitos/reglas-de-negocio.md`)

- **Estados como datos**: el avance valida contra `transicion_etapa`; el retroceso requiere confirmación; cada movimiento escribe en `historial_caso` (**inmutable**, append-only). (RN-04, RN-05, RN-06, ADR-0008)
- `caso.etapa_actual_id` debe ser una etapa de la **misma área** del caso (validar en servicio). `tipo_reclamo` solo en ART.
- Un caso → 1 cliente + 1 abogado responsable (RN-01). DNI de cliente único → **409** (RN-03).
- Solo **SOCIO** gestiona usuarios (RN-07). Lectura amplia de casos para todo usuario (RN-08).
- **Telegramas** solo en casos Laborales, hasta 3 por caso (RN-15, RN-16).
- **Comunicaciones**: nunca se envían solas; el agente n8n las genera y el backend las persiste como `PENDIENTE_REVISION`; el paso a `APROBADO` lo hace una persona (RN-10, RN-19).
- **Batch 15 días (WF-05)**: la cadencia y la idempotencia se calculan en el backend (`GET /internal/casos/pendientes-actualizacion`). (RN-20..22)
- **Documentos**: solo el abogado sube; el cliente nunca (RN-12).

## Endpoints (contratos completos en `docs/04-api/contratos-api.md`)

- `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` (cookies + revocación).
- CRUD de clientes, casos (con ficha de admisión), documentos, vencimientos; backups.
- `POST /casos/{id}/actualizacion` — dispara WF-01; devuelve borrador. No envía.
- Internos (uso de n8n, protegidos por secreto): `GET /internal/casos/{id}/contexto`, `GET /internal/casos/pendientes-actualizacion`, `POST /internal/casos/{id}/comunicaciones`.
- `GET /comunicaciones?estado=PENDIENTE_REVISION` · `PATCH /comunicaciones/{id}`.
- Documentos en R2 vía **URLs prefirmadas** (init → PUT a R2 → registrar metadata). (ADR-0007)

## Migraciones de base de datos

La capa de persistencia usa **SQLAlchemy 2.x** (modelos en `features/*/models.py`, `Base` en `core/db_base.py`) y **Alembic** para migraciones.

### En Docker (automático)
`docker compose up --build` corre `alembic upgrade head` dentro del contenedor backend antes de arrancar Uvicorn. El orden está garantizado por `depends_on: db: condition: service_healthy`.

### En local
```bash
# Con la DB del compose corriendo en localhost:5432 (o la que corresponda):
export DATABASE_URL=postgresql://iuris:changeme@localhost:5432/iuris
cd backend
alembic upgrade head      # aplica todas las migraciones pendientes
alembic current           # muestra la revisión activa
alembic downgrade base    # revierte todo (útil para testing)
```

### Verificación post-migración
- `psql $DATABASE_URL -c "\dt"` → debe listar las 13 tablas.
- `psql $DATABASE_URL -c "\dT"` → debe listar los 12 tipos enum.
- `alembic current` → debe mostrar `001 (head)`.
- `etapa`, `transicion_etapa` e `historial_caso` existen y están vacías (sin seed).

### Agregar una nueva revisión
```bash
alembic revision --autogenerate -m "descripcion del cambio"
# Revisar el archivo generado en alembic/versions/ antes de aplicarlo.
alembic upgrade head
```

> **Regla SDD**: toda modificación del esquema entra como nueva revisión de Alembic
> y actualiza `docs/03-arquitectura/modelo-de-datos.dbml` en el mismo PR.

## Convenciones

- PEP 8; **Black**, **isort**, **ruff**; type hints; validación Pydantic.
- Migraciones con **Alembic** (nada manual en producción).
- `pytest`, cobertura ≥ 80%, usando la **base sintética**.

## No hacer

- No agregar IA (LLM/prompts/keys). No exponer n8n a internet ni dejar que el frontend lo llame.
- No tokens en el body/headers (van en cookies). No secretos ni datos reales en el repo.
