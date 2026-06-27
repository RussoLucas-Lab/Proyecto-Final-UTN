## Why

El **caso** es el núcleo del sistema: todo lo demás (documentos, comunicaciones IA, telegramas, vencimientos) cuelga de un caso. Ya existen los clientes (admisión) y el catálogo de etapas/transiciones por área (seed `ciclo-de-vida-seed`), pero **no hay forma de abrir un caso, registrar su ficha de admisión, moverlo de etapa ni consultar su historial**. Sin este ABM + máquina de estados no se puede operar el estudio. RF-08 a RF-13 y RN-01/04/05/06/08/09/11 definen exactamente esta funcionalidad, y las tablas (`caso`, `ficha_laboral`, `etapa`, `transicion_etapa`, `historial_caso`) ya están migradas (migración `001`) con sus modelos ORM en `features/casos/models.py`.

## What Changes

- **ABM de casos y máquina de estados (estados como datos, ADR-0008)** sobre tablas ya existentes (migración `001`): no se crea esquema nuevo ni migración. El change **consume** el catálogo de etapas/transiciones cargado por el seed `ciclo-de-vida-seed`; nunca lo recrea ni hardcodea un enum de estados.
  - `POST /casos` — alta de un caso vinculado a **un** cliente y **un** abogado responsable, indicando `area` (LABORAL / ART) y, solo en ART, `tipo_reclamo` (ACCIDENTE / ENFERMEDAD). El caso nace en la **etapa inicial** del área ("Toma del cliente", resuelta como dato por `area` + `orden` mínimo, NO hardcodeada) y genera la **primera entrada de historial** (`etapa_anterior_id = NULL`). La **ficha laboral** puede viajar anidada (1:1) y omitirse para completarla luego. **201**. (RF-08, RF-09, RN-01, RN-05, RN-11)
  - `PUT /casos/{id}/ficha-laboral` — crea o actualiza la ficha de admisión laboral del caso (1:1). **200**/**404**. (RF-09)
  - `GET /casos/{id}` — detalle del caso (cliente, área, etapa actual, ficha, fechas, observaciones) e incluye las **transiciones válidas** desde la etapa actual (para el stepper del frontend). **200**/**404**. (RF-13, soporte UC-04)
  - `GET /casos?area=&etapa=&abogado_id=&cliente_id=&page=` — listado paginado con filtros por área, etapa, abogado o cliente. Lectura amplia para todo autenticado (RN-08). **200**. (RF-13)
  - `POST /casos/{id}/avanzar` — avanza a una etapa destino **validando que exista una transición permitida** desde la etapa actual en `transicion_etapa` (RN-04, intra-área RN-11). Acción **manual**. Inserta historial (RN-05). **200**; **409** si la transición no es válida. (RF-10)
  - `POST /casos/{id}/retroceder` — retrocede de etapa; **requiere confirmación explícita** (`{ "confirmar": true }`) cuando el caso está en etapa terminal (RN-09). Inserta historial (RN-05). **200**; **409**/**422** sin confirmación. (RF-11, incluido por cohesión de la máquina de estados)
  - `GET /casos/{id}/historial` — historial **cronológico e inmutable** de movimientos del caso (append-only, RN-06). **200**/**404**. (RF-12)
- **Etapa inicial y avance/retroceso resueltos como DATOS (ADR-0008)**: la etapa inicial se obtiene consultando `etapa` por `area` y menor `orden`; el avance se valida contra `transicion_etapa`; la terminalidad sale de `etapa.es_terminal`. **Nunca** se hardcodea un enum ni nombres de etapa en backend o frontend.
- **Historial inmutable (RN-05/RN-06)**: cada cambio de etapa (creación, avance, retroceso) escribe una fila en `historial_caso` con `etapa_anterior_id`, `etapa_nueva_id`, `evento`, `autor_id` y `ocurrido_en`. El servicio expone solo lectura e inserción; nunca update/delete sobre el historial.
- **Reutiliza la seguridad transversal existente** (`get_current_user`, `require_roles`, CSRF double-submit, rate limiting, validación Pydantic). No se reimplementa auth.
  - **Lectura** (`GET`) disponible para todo usuario autenticado (RN-08).
  - **Mutaciones** (`POST`/`PUT`) permitidas a **ABOGADO y SOCIO** (la operación de casos es del abogado).
- Frontend: completar la feature `casos` (ya hay rutas y páginas stub en `App.tsx`: `CasosPage`, `NuevoCasoPage`, `CasoLaboralPage`, `CasoARTPage`) con listado + filtros, alta con ficha, detalle con stepper de etapas (avanzar/retroceder con confirmación) e historial.

**Fuera de alcance** (features separadas, NO incluidas): documentos/R2 (RF-14/15), comunicaciones IA/n8n (RF-16/18/26), generador de telegramas (RF-25), agenda de vencimientos (RF-19/20).

## Capabilities

### New Capabilities
- `gestion-casos`: ABM de casos + máquina de estados "estados como datos" — alta (1 cliente + 1 abogado + área, etapa inicial automática), ficha laboral 1:1, avance validado contra `transicion_etapa`, retroceso con confirmación, historial inmutable, y listado/filtros — apoyado en el catálogo `ciclo-de-vida-seed` y en la autenticación/RBAC/CSRF existentes.

### Modified Capabilities
<!-- Ninguna: este change consume ciclo-de-vida-seed, esquema-base-datos, autorizacion-rbac y proteccion-web sin cambiar sus requisitos. Las tablas y el catálogo de etapas ya existen y no se modifican. -->

## Impact

- **Backend**: nueva feature `backend/app/features/casos/` (`router.py`, `service.py`, `schemas.py`, `dependencies.py`); **reusa** los modelos `Caso`, `FichaLaboral`, `Etapa`, `TransicionEtapa`, `HistorialCaso` ya existentes en `features/casos/models.py` (NO se redefinen). Enganche del router en `app/main.py`. Reutiliza `core/dependencies.py` (`get_current_user`, `require_roles`), `core/middleware.py` (CSRF) y `core/rate_limit.py`.
- **Base de datos**: ninguna migración nueva — las tablas `caso`, `ficha_laboral`, `etapa`, `transicion_etapa`, `historial_caso` ya existen en `001_esquema_base_inicial.py`. Las etapas/transiciones las carga el seed `ciclo-de-vida-seed` (prerequisito operativo, no parte de este change).
- **Frontend**: completar `frontend/src/features/casos/` (`api.ts`, `types.ts`, `components/`, `hooks/`, páginas existentes); rutas ya montadas en `app/App.tsx` con `RequireAuth`.
- **API**: agrega `GET/POST /casos`, `GET /casos/{id}`, `PUT /casos/{id}/ficha-laboral`, `POST /casos/{id}/avanzar`, `POST /casos/{id}/retroceder`, `GET /casos/{id}/historial` bajo `/api/v1`. Coherente con `docs/04-api/contratos-api.md` (sección "Casos"); si hay desvíos menores se alinea el contrato en el mismo PR (regla SDD) y se registra en `docs/changemap.md`.
- **Changemap**: marca RF-08 / RF-09 / RF-10 / RF-11 / RF-12 / RF-13 (feature `casos`) como en progreso/hechas.
- **Sin impacto** en IA/n8n, documentos, telegramas ni vencimientos (features aparte). Sin cambios en el contrato de auth ni en el seed de etapas.
