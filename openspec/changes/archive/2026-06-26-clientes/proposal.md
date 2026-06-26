## Why

El estudio admite personas (clientes) antes de poder abrir un caso: el flujo de **admisión** (RF-05, UC-02) registra los datos de la persona y es el punto de entrada de todo el sistema. Hoy existe la tabla `cliente` y su modelo ORM (creados en `migraciones-esquema-base`), pero **no hay forma de dar de alta, consultar, editar ni buscar clientes** desde la plataforma. Sin este ABM no se puede iniciar la operación real (no hay clientes a quienes asociar casos). RF-05/RF-06/RF-07 y RN-03 (DNI único) definen exactamente esta funcionalidad.

## What Changes

- **ABM de clientes (admisión)** sobre la tabla `cliente` ya existente (migración `001`): no se crea esquema nuevo ni migración.
  - `POST /clientes` — alta del cliente (admisión, RF-05/UC-02). Body con `nombre`, `dni`, `cuil`, `telefono`, `email`, `domicilio_real` y sus sub-campos `domicilio_real_cp`/`_localidad`/`_provincia`, y `domicilio_coincide_dni`. **201**; **409** si el DNI ya existe (RN-03).
  - `GET /clientes/{id}` — consulta de un cliente (RF-06). **404** si no existe.
  - `PUT /clientes/{id}` — edición de los datos del cliente (RF-06). **200**/**404**; **409** si el nuevo DNI colisiona con otro cliente.
  - `GET /clientes?search=&page=` — listado paginado con búsqueda por **nombre o DNI** (RF-07, P1). Lectura amplia para todo usuario autenticado (RN-08).
- **DNI único en el estudio (RN-03)**: la unicidad se garantiza por la restricción `unique` de la tabla; el servicio traduce la colisión a **409**.
- **Body de `POST /clientes` corregido respecto al ejemplo de API**: el contrato en `docs/04-api/contratos-api.md` muestra solo `nombre/dni/telefono/email`, pero el modelo de datos exige incluir `cuil` y `domicilio_real` (+ CP/localidad/provincia). Se alinea la spec de API en el mismo PR (regla SDD; nota ya registrada en `docs/changemap.md`).
- **Reutiliza la seguridad transversal existente** (`get_current_user`, RBAC, CSRF middleware double-submit, rate limiting, validación Pydantic). No se reimplementa nada de auth.
  - **Lectura** (`GET`) disponible para todo usuario autenticado (RN-08).
  - **Mutaciones** (`POST`/`PUT`) permitidas a **ABOGADO y SOCIO** (la admisión es operación del abogado, RF-05/RF-06).
- Frontend: nueva feature `clientes` (listado + búsqueda + alta + edición), accesible para todo usuario autenticado.

## Capabilities

### New Capabilities
- `gestion-clientes`: ABM de clientes del estudio (admisión) — alta con DNI único, consulta, edición y listado/búsqueda por nombre o DNI — apoyado en la autenticación, el RBAC y la protección CSRF existentes.

### Modified Capabilities
<!-- Ninguna: este change reutiliza autorizacion-rbac y proteccion-web sin cambiar sus requisitos; solo los consume. El esquema de la tabla `cliente` ya existe (esquema-base-datos) y no se modifica. -->

## Impact

- **Backend**: nueva feature `backend/app/features/clientes/` (`router.py`, `service.py`, `schemas.py`, `dependencies.py`); reusa el modelo `Cliente` ya existente en `features/clientes/models.py` (NO se redefine). Enganche del router en `app/main.py`. Reutiliza `core/dependencies.py` (`get_current_user`, guards de rol), `core/middleware.py` (CSRF) y `core/rate_limit.py`.
- **Base de datos**: ninguna migración nueva — la tabla `cliente` ya existe en `001_esquema_base_inicial.py` con `dni` único.
- **Frontend**: nueva feature `frontend/src/features/clientes/` (`api.ts`, `types.ts`, `components/`, `hooks/`, `pages/`); ruta protegida (autenticado) en el router de `app/`.
- **API**: agrega `GET/POST /clientes`, `GET/PUT /clientes/{id}` bajo `/api/v1`; corrige el body de `POST /clientes` en `docs/04-api/contratos-api.md` (incluir `cuil` y `domicilio_real`) y la etiqueta de `GET /clientes?search=` (RF-07, no RF-06).
- **Changemap**: marca las filas RF-05 / RF-06 / RF-07 (feature `clientes`) como en progreso/hechas.
- **Sin impacto** en IA/n8n, ciclo de vida de casos, documentos ni en el contrato de auth.
