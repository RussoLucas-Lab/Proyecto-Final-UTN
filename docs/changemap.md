# Changemap — Tablero de Control de Cambios (Iuris)

> **Propósito.** Tablero único de trazabilidad entre las specs de `docs/` (fuente de verdad,
> SDD) y la implementación. Mapea cada funcionalidad del MVP a su RF/UC, capa, feature,
> prioridad y estado. Sirve para saber, de un vistazo, qué falta, qué está en curso y dónde
> el código se aparta de la spec.
>
> **Se actualiza en CADA PR.** Todo PR que toque una funcionalidad: (1) cambia el estado de su
> fila, (2) completa la columna Rama/PR, (3) agrega una línea al changelog y, si corresponde,
> (4) registra un desvío. Recordá la regla SDD: si código y spec divergen, **gana la spec** o
> se actualiza la spec **primero**, en el mismo PR.

## Leyenda de estados

🔲 Pendiente · 🟡 En progreso · ✅ Hecho · ⏸️ Bloqueado · 🔄 En revisión

**Prioridad** (deriva de MoSCoW en `01-requisitos/requisitos-funcionales.md`): **P0** = Must · **P1** = Should.
**Capa**: `backend` (FastAPI) · `frontend` (React) · `n8n` (orquestación/IA) · `db` (esquema/seed).

---

## Tabla de trazabilidad del MVP

### Plataforma / Infraestructura (base, sin RF propio — deriva de RNF-07, `07-seguridad-y-despliegue/`)

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RNF-07 / 07-seg | Esqueleto del repo + `docker-compose` (frontend, backend, db, n8n) y `GET /health` | backend·frontend·db·n8n | plataforma | P0 | 🟡 | `master` | Esqueleto implementado: `backend/app/`, `docker-compose.yml`, `.env.example`, `GET /health` verificado localmente. Smoke test Docker pendiente de ejecución manual. |
| ADR-0010 | Storage S3-compatible: MinIO en dev, Cloudflare R2 en prod. `core/storage.py` + `minio`/`minio-init` en docker-compose. | backend·infra | plataforma | P0 | ✅ | `master` (change `storage-infra`) | `StorageClient` configurable por env vars; `generate_presigned_url` con reemplazo de hostname dev. 5 tests unitarios. ADR-0010 creado. |
| RNF-09 / 10-seg | Migraciones Alembic + esquema base (DBML v2) | db·backend | plataforma | P0 | ✅ | `master` (change `migraciones-esquema-base`) | 13 tablas, 12 enums, todas las FKs/índices/unicidades del DBML v2. `entrypoint.sh` corre `alembic upgrade head` antes de Uvicorn. Sin seed (próximo change ADR-0008). |
| ADR-0008 / RN-04 | Seed del ciclo de vida (18 etapas, 19 transiciones) | db·backend | casos | P0 | ✅ | `master` (change `seed-ciclo-de-vida`) | `backend/seeds/seed_etapas.sql` (canónico) + `etapas_seed_data.py` (programático). Tests en `backend/tests/features/casos/test_seed_etapas.py`. Idempotente. Fuente: ADR-0008, RN-04/RN-09, diagramas. |

### auth

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-01 / UC-01 | Login: emite access (15m) + refresh (7d) en cookies HttpOnly/Secure/SameSite | backend·frontend | auth | P0 | 🔲 | — | `refresh_token` revocable en DB. Incluye renovación `POST /auth/refresh`. |
| RF-02 | RBAC: roles SOCIO/ABOGADO + cuenta activa por endpoint | backend | auth | P0 | 🔲 | — | RNF-01. |
| RF-04 / UC-01 | Logout: revoca refresh + limpia cookies + log del evento | backend·frontend | auth | P0 | 🔲 | — | — |
| RNF-11 | CSRF en mutaciones (token / double-submit) | backend·frontend | auth | P0 | 🔲 | — | Double-submit cookie: `csrf_token` (no HttpOnly) + header `X-CSRF-Token`. Ver §5 de `07-seguridad-y-despliegue/`. |

### usuarios

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-03 | ABM de usuarios (alta / edición / desactivación) — solo SOCIO | backend·frontend | usuarios | P0 | ✅ | `master` (change `usuarios`) | RN-07. Implementado: `backend/app/features/usuarios/` (schemas, service, router), tests en `tests/features/usuarios/`. Frontend: `frontend/src/features/usuarios/` (types, api, hook, form, page). Desvío D2: `POST /usuarios` acepta `password` — actualizado `contratos-api.md`. Deuda: complejidad de password pendiente. |

### clientes

Lee docs\documentos_minio.md antes de escribir el change

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-05 / UC-02 | Crear cliente (admisión, datos de la persona); DNI único → 409 | backend·frontend | clientes | P0 | ✅ | `master` (change `clientes`) | RN-03. Implementado: `backend/app/features/clientes/` (schemas, service, router, dependencies), tests en `tests/features/clientes/`. Frontend: `frontend/src/features/clientes/` (types, api, hook, form, pages). **Desvío D2**: `POST /clientes` incluye `cuil` y `domicilio_real` desglosado (cp/localidad/provincia) — actualizado `contratos-api.md`. |
| RF-06 | Editar y consultar cliente | backend·frontend | clientes | P0 | ✅ | `master` (change `clientes`) | `GET/PUT /clientes/{id}`. RBAC: ABOGADO+SOCIO para mutaciones, lectura amplia para autenticados (D4). |
| RF-07 | Listar y buscar clientes (nombre/DNI) | backend·frontend | clientes | P1 | ✅ | `master` (change `clientes`) | `GET /clientes?search=&page=` — etiqueta corregida (figuraba como RF-06 en API). Búsqueda ILIKE case-insensitive, paginación offset/limit. |

### casos

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-08 / UC-03 | Crear caso (cliente + abogado + área; ART → tipo_reclamo); etapa inicial + 1ª entrada de historial | backend·frontend | casos | P0 | ✅ | `master` (change `casos`) | RN-01, RN-05, RN-11. Etapa inicial resuelta por menor `orden` del área (ADR-0008). Frontend: NuevoCasoPage conectado a API real. |
| RF-09 / UC-03 | Registrar ficha laboral de admisión (1:1 con el caso) | backend·frontend | casos | P0 | ✅ | `master` (change `casos`) | Anidada en `POST /casos` (opcional); `PUT /casos/{id}/ficha-laboral` upsert implementado. |
| RF-10 / UC-04 | Avanzar etapa según transiciones válidas del área | backend·frontend | casos | P0 | ✅ | `master` (change `casos`) | RN-04, RN-05. `POST /casos/{id}/avanzar`. Frontend: StepperEtapas data-driven (ADR-0008). |
| RF-11 / UC-04 | Retroceder etapa con confirmación explícita | backend·frontend | casos | P0 | ✅ | `master` (change `casos`) | RN-09. `{ "confirmar": true }` obligatorio. Frontend: RetrocederModal con confirmación. |
| RF-12 / UC-04 | Historial cronológico inmutable | backend·frontend | casos | P0 | ✅ | `master` (change `casos`) | RN-05, RN-06. `historial_caso` append-only. Frontend: HistorialTimeline. No existe DELETE. |
| RF-13 | Listar y filtrar casos (área/etapa/abogado/cliente) | backend·frontend | casos | P1 | ✅ | `master` (change `casos`) | `GET /casos?area=&etapa_id=&abogado_id=&cliente_id=&page=`. Lectura amplia para autenticados (RN-08). Frontend: CasosPage con filtros en vivo. |

### documentos

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-14 / UC-05 | Subir documentos (drag&drop, R2 URL prefirmada, init→PUT→registrar). Solo abogado | backend·frontend | documentos | P0 | 🔲 | — | RN-02, RN-12, ADR-0007. `415` formato no permitido. |
| RF-15 | Listar / previsualizar / descargar (URL prefirmada) | backend·frontend | documentos | P0 | 🔲 | — | `GET /documentos/{id}/url`. |

### comunicaciones (IA asistencial — vive en n8n)

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-16 / UC-06 | Generar borrador de actualización (WF-01): backend dispara webhook n8n; agente usa `GET /internal/casos/{id}/contexto` | backend·n8n·frontend | comunicaciones | P0 | ✅ | `master` (change `comunicaciones`) | RN-10. `503` si IA no disponible. Backend SIN IA (ADR-0003). |
| RF-17 / UC-06 | Editar el borrador antes de usarlo | frontend | comunicaciones | P0 | ✅ | `master` (change `comunicaciones`) | `POST /casos/{id}/actualizacion` persiste el borrador (`tipo=MANUAL`, `estado=PENDIENTE_REVISION`) y lo devuelve con su id. EditorBorrador con textarea editable. |
| RF-18 | No enviar nada automáticamente (acción humana explícita) | backend·frontend·n8n | comunicaciones | P0 | ✅ | `master` (change `comunicaciones`) | RN-10, RNF-04. Mensaje "El envío al cliente es manual — no se envía solo" en EditorBorrador. |
| RF-26 / UC-10 (RF-26.1..4) | Batch 15 días (WF-05): detectar pendientes, generar, persistir `PENDIENTE_REVISION`, revisar/aprobar/descartar en la UI | backend·n8n·frontend | comunicaciones | P1 | ✅ | `master` (change `comunicaciones-2`) | RN-19..23. Cadencia/idempotencia en backend (`GET /internal/casos/pendientes-actualizacion`, `POST /internal/casos/{id}/comunicaciones`). Revisión: `GET /comunicaciones`, `PATCH /comunicaciones/{id}` (aprobar reinicia la ventana de 15 días, D4). `BatchPage.tsx` cableada a datos reales. |

### telegramas (determinístico, sin IA, sin n8n)

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-25.1-.3 / UC-09 | Generar telegrama Ley 23.789 prellenado y editable (pdf-lib en navegador) + descargar PDF | frontend | telegramas | P0 | 🔲 | — | RN-15 (solo Laboral), RN-17. Prellenado desde `GET /casos/{id}` + `ficha_laboral`. |
| RF-25.4 / RN-18 | Guardar PDF como documento del caso y registrar el `telegrama` (nº 1-3, resultado PENDIENTE) | backend·frontend | telegramas | P1 | 🔲 | — | RN-16. `POST /casos/{id}/telegramas` + `PATCH /telegramas/{id}`. |

### vencimientos / agenda

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-19 | Registrar vencimientos/movimientos del caso | backend·frontend | vencimientos | P0 | 🔲 | — | `POST /casos/{id}/vencimientos` + `PATCH /vencimientos/{id}` (`{ "completado": true }`). |
| RF-20 / UC-11 | Vista calendario de movimientos (todo el estudio, sin notificaciones) | backend·frontend | vencimientos | P1 | 🔲 | — | `GET /vencimientos?desde=&hasta=`. |

### backups

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-21 | Respaldo automático programado (cron, WF-02) + respaldo manual (SOCIO) | n8n·backend | backups | P0 | 🔲 | — | RN-13, RNF-08. `POST /backups`. n8n genera Excel → storage → registra. |
| RF-22 / UC-12 | Historial de respaldos (fecha, tipo, estado) — SOCIO | backend·frontend | backups | P0 | 🔲 | — | `GET /backups`. |

---

## Registro cronológico (changelog)

| Fecha | Qué cambió | Specs afectadas | Autor |
|-------|------------|-----------------|-------|
| 2026-06-24 | Creación del changemap: orientación inicial, análisis de consistencia y tabla de trazabilidad del MVP precargada (todas las filas 🔲 Pendiente). Sin código. | Todas las de `docs/` (lectura) | Lucas / Claude Code |
| 2026-06-24 | Correcciones de cosmética en docs: etiqueta RF-06→RF-07 en `contratos-api.md`; artefacto heredoc eliminado de `seguridad-y-despliegue.md`; referencia `07-operacion/` → `09-operacion/` en `arquitectura-del-sistema.md`; ruta del seed corregida a `backend/seeds/` en `CLAUDE.md`. Ítems 9-12 de pendientes cerrados. | `04-api/contratos-api.md`, `07-seguridad-y-despliegue/seguridad-y-despliegue.md`, `03-arquitectura/arquitectura-del-sistema.md`, `CLAUDE.md` | Lucas |
| 2026-06-24 | Sincronización docs #1-8: endpoints de usuarios (UC-13), ficha laboral (`PUT /casos/{id}/ficha-laboral`), telegramas (`POST/PATCH`), comunicación manual (persiste en BD), vencimientos (`PATCH /vencimientos/{id}`), CSRF (double-submit cookie) y campos de telegrama en modelo DBML. Todos los huecos de spec cerrados; RF-23/RF-24 confirmados intencionales. Sin huecos abiertos. | `04-api/contratos-api.md`, `02-comportamiento/casos-de-uso.md`, `07-seguridad-y-despliegue/seguridad-y-despliegue.md`, `03-arquitectura/modelo-de-datos.dbml`, `03-arquitectura/modelo-de-datos.md`, `08-features/generador-telegramas.md` | Lucas |
| 2026-06-25 | Change `esqueleto-plataforma` (RNF-07): esqueleto del monorepo feature-first. Creados `backend/app/` (main.py, core/, shared/, features/), `backend/requirements.txt`, `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` (4 servicios, red privada, volúmenes nombrados), `.env.example` con activas + placeholders. `GET /health` implementado y verificado localmente (200 `{"status":"UP"}`). Smoke test Docker pendiente de ejecución manual. | RNF-07, RNF-13 | Claude Code |
| 2026-06-25 | Change `migraciones-esquema-base` (RNF-09): SQLAlchemy 2.x + Alembic instalados. Infraestructura transversal (`core/db_base.py`, `core/database.py`, `core/models_registry.py`, `shared/enums.py`). 13 modelos ORM en `features/*/models.py`. Migración inicial `001_esquema_base_inicial.py` con 12 enums y 13 tablas en orden FK correcto. `entrypoint.sh` en Dockerfile ejecuta `alembic upgrade head` antes de Uvicorn. `depends_on: service_healthy` ya configurado. Sin seed (próximo change). | RNF-09, ADR-0009 | Claude Code |
| 2026-06-25 | Change `seed-ciclo-de-vida` (ADR-0008, RN-04): seed del ciclo de vida depurado y anclado a la spec. `seed_etapas.sql` (canónico) y `etapas_seed_data.py` actualizados: citas reemplazadas (INFORME→docs/), índice redundante `ux_etapa_area_nombre` eliminado, encabezado con orden de ejecución. Tests en `backend/tests/features/casos/test_seed_etapas.py`: conteos (18/19), idempotencia, terminalidad, coherencia del grafo, guardrail sin enums hardcodeados. Infraestructura de tests creada (`tests/`, `conftest.py`, `requirements-dev.txt`). Verificación con DB live pendiente de ejecución manual (tasks 5.1/5.2). | ADR-0008, RN-04, RN-09 | Claude Code |
| 2026-06-26 | Change `usuarios` (RF-03, RN-07): ABM de usuarios implementado. Backend: `features/usuarios/` (schemas, service, router) con CSRF, RBAC SOCIO, rate limiting 100/min, baja lógica, autodesactivación prohibida. Tests: 29 casos en `tests/features/usuarios/`. Frontend: `features/usuarios/` (types, api, hook, form, page) con modal alta/edición y toggle. Ruta `/usuarios` ya existía protegida con `RequireSocio`. Desvío D2 registrado (ver debajo). Deuda de complejidad de password registrada. | RF-03, RN-07, UC-13, `04-api/contratos-api.md` | Claude Code |
| 2026-06-26 | Change `clientes` (RF-05, RF-06, RF-07, RN-03): ABM de clientes implementado. Backend: `features/clientes/` (schemas, service, router, dependencies) + router enganchado en `main.py`. Tests en `tests/features/clientes/` (CSRF, RBAC, DNI duplicado, búsqueda, paginación). Frontend: `features/clientes/` (types, api, hooks/useClientes, components/ClienteForm, ClientesPage, NuevoClientePage) — páginas conectadas al backend real (antes mock). Rutas `/clientes` y `/clientes/nuevo` ya existían en App.tsx. **Desvío D2**: `POST /clientes` incluye `cuil` y `domicilio_real` desglosado — `contratos-api.md` actualizado. Etiqueta `GET /clientes?search=` corregida a RF-07. | RF-05, RF-06, RF-07, RN-03, UC-02, `04-api/contratos-api.md` | Claude Code |
| 2026-06-29 | Change `storage-infra` (ADR-0010): abstracción de storage S3-compatible. `core/storage.py` (`StorageClient`, `get_storage_client()`). MinIO + `minio-init` en `docker-compose.yml` (bucket `iuris-docs` auto-creado, política privada). `backend` depende de `minio-init: service_completed_successfully`. Env vars `STORAGE_*` en `.env.example`. `boto3` en `requirements.txt`. 5 tests unitarios en `tests/core/test_storage.py`. ADR-0010 creado. | ADR-0010, `docker-compose.yml`, `.env.example`, `backend/requirements.txt` | Claude Code |
| 2026-06-30 | Change `comunicaciones` (RF-16, RF-17, RF-18, RN-10, ADR-0003): flujo individual de generación de borradores IA implementado. Backend: `features/comunicaciones/` (schemas, service, router, dependencies). Core: `N8N_WF01_WEBHOOK_URL`/`N8N_INTERNAL_SECRET` en config; exención `/internal` en CSRFMiddleware; router registrado en `main.py`. n8n: `WF-01-generar-actualizacion.json` (Webhook→AI Agent→HTTP Tool→Respond). Frontend: `types.ts`, `api.ts`, `hooks/useGenerarActualizacion.ts`, `components/EditorBorrador.tsx`, `IAModal.tsx` actualizado con `casoId`; integrado en `CasoARTPage`/`CasoLaboralPage`. Tests backend: conftest + test_service (7 casos unitarios) + test_router (8 casos de integración). Humano en el bucle garantizado: nada se envía solo; mensaje explícito en el frontend. | RF-16, RF-17, RF-18, RN-10, ADR-0003 | Claude Code |
| 2026-06-26 | Change `casos` (RF-08 a RF-13, RN-04/05/06/09/11, ADR-0008): ABM de casos + máquina de estados implementado. Backend: `features/casos/` (schemas, service, router, dependencies) + router en `main.py`. 7 endpoints completos con CSRF, RBAC, rate limiting. Diseño clave: etapa inicial por dato (menor `orden` del área — ADR-0008), historial append-only (RN-06), retroceso con `confirmar:true` (RN-09). Tests en `tests/features/casos/` (conftest + test_router: 25+ casos cubriendo CSRF, RBAC, transitions, historial, paginación). Frontend: types.ts, api.ts, hooks (useCasos, useCaso), components (StepperEtapas data-driven, HistorialTimeline, RetrocederModal), páginas actualizadas (CasosPage, CasoLaboralPage, CasoARTPage, NuevoCasoPage) — eliminados todos los mocks hardcodeados. `contratos-api.md` actualizado con schemas completos. **Pendiente ejecución en Docker**: `docker compose exec backend pytest tests/features/casos/ --cov=app/features/casos`. | RF-08, RF-09, RF-10, RF-11, RF-12, RF-13, RN-04, RN-05, RN-06, RN-09, RN-11, ADR-0008, `04-api/contratos-api.md` | Claude Code |
| 2026-07-01 | Change `comunicaciones-2` (RF-26 / UC-10, RN-19..23, D1-D7): batch de actualizaciones cada 15 días implementado, aditivo sobre la feature `comunicaciones` (sin migración nueva). Backend: 4 endpoints nuevos en `comunicaciones/router.py` (`GET /internal/casos/pendientes-actualizacion`, `POST /internal/casos/{id}/comunicaciones`, `GET /comunicaciones`, `PATCH /comunicaciones/{id}`) + lógica en `service.py` (`calcular_casos_pendientes`, `persistir_borrador_automatico`, `listar_comunicaciones`, `revisar_comunicacion`) + schemas nuevos. Cadencia/idempotencia calculadas en el backend (D1), aprobar reinicia la ventana de 15 días (D4). n8n: `WF-05-batch-actualizaciones.json` (Schedule Trigger 07:00 `America/Argentina/Buenos_Aires` → Set Internal Secret → HTTP GET pendientes → IF → Split Out/Split In Batches → AI Agent de WF-01 reutilizado → HTTP POST persistir), validado importándolo contra una instancia real de n8n vía API REST (200 OK, 11 nodos). Corrige para WF-05 el patrón `$env` embebido en tool sub-node que WF-01 todavía arrastra (skill `n8n-workflow`): usa un nodo Set en la cadena principal. `docker-compose.yml`: `GENERIC_TIMEZONE`/`TZ` agregados al servicio `n8n`. Frontend: `BatchPage.tsx` cableada a datos reales (antes mock), `types.ts`/`api.ts` extendidos. Tests backend: 54/54 verdes, 98% cobertura en `features/comunicaciones/` (100% en router/service/schemas). De paso se corrigieron dos bugs preexistentes en `tests/features/comunicaciones/conftest.py`: el reset del rate limiter usaba un atributo inexistente (no-op silencioso) y `db_session` no truncaba `etapa`/`transicion_etapa` entre tests. Verificación end-to-end manual con `docker compose up` + Playwright (login, listado real, aprobar/descartar con persistencia correcta en DB), datos de prueba limpiados. **Pendiente**: smoke test real de WF-05 disparando el Schedule Trigger con backend + OpenAI en vivo; el change `dashboard` debe recortar su capability `revision-comunicaciones` y consumir estos endpoints (ver `openspec/changes/comunicaciones-2/proposal.md`). | RF-26, RN-19, RN-20, RN-21, RN-22, RN-23, `04-api/contratos-api.md` | Claude Code |

---

## Desvíos respecto de la spec

> Registrar acá cada vez que el código se aparte de una spec. Regla SDD: **gana la spec**, o se
> actualiza la spec **primero** (en el mismo PR). Un desvío sin ADR o sin actualización de spec
> es deuda que debe resolverse.

| Fecha | Funcionalidad | Spec afectada | Qué se desvía y por qué | ADR / spec actualizada | Estado |
|-------|---------------|---------------|-------------------------|------------------------|--------|
| 2026-06-26 | RF-03 — `POST /usuarios` (D2) | `04-api/contratos-api.md` | El contrato original no incluía `password` en el body. El modelo exige `password_hash NOT NULL` y no hay flujo de invitación por email en el MVP. Solución: el SOCIO provee la contraseña inicial en el alta. | `04-api/contratos-api.md` actualizado en el mismo PR (sección Usuarios). | ✅ Resuelto |
| 2026-06-26 | RF-05 — `POST /clientes` (D2) | `04-api/contratos-api.md` | El ejemplo original solo mostraba `{ nombre, dni, telefono, email }`. El modelo DBML v2 define `cuil` y `domicilio_real` desglosado (cp/localidad/provincia) + `domicilio_coincide_dni`. Solución: `ClienteCreate` incluye todos esos campos (opcionales); `contratos-api.md` actualizado. | `04-api/contratos-api.md` actualizado en el mismo PR (sección Clientes). | ✅ Resuelto |

### Deudas técnicas registradas

| Fecha | Feature | Deuda | Resolución propuesta |
|-------|---------|-------|---------------------|
| 2026-06-26 | usuarios (RF-03) | No existe validación centralizada de complejidad de contraseña. `POST /usuarios` acepta `password` con `min_length=1` únicamente (igual que `LoginRequest` en auth). | Cuando se implemente registro/cambio de contraseña self-service, extraer la validación de complejidad a un validador compartido en `core/` y reutilizarlo en `usuarios`. NO inventar regla ad-hoc hasta entonces. |

---

## Pendientes de confirmar (lista viva)

Hallazgos del análisis de consistencia. **B** = bloqueante para su feature (no para el arranque del MVP).
Marcar resuelto cuando se actualice la spec correspondiente.

### Huecos (spec incompleta)

1. ~~**[B] RF-03 sin contrato de API ni caso de uso.**~~ ✅ Resuelto 2026-06-24 — `GET/POST /usuarios`, `PUT/PATCH /usuarios/{id}` definidos en `04-api/contratos-api.md`; `UC-13` en `02-comportamiento/casos-de-uso.md`.
2. ~~**[B] RF-09 (ficha laboral) sin endpoint.**~~ ✅ Resuelto 2026-06-24 — `POST /casos` acepta `ficha_laboral` anidada (opcional); `PUT /casos/{id}/ficha-laboral` la crea o actualiza.
3. ~~**[B] Registro de telegrama sin endpoint (RF-25.4 / RN-18).**~~ ✅ Resuelto 2026-06-24 — `POST /casos/{id}/telegramas` (crea con `resultado=PENDIENTE`) + `PATCH /telegramas/{id}` (actualiza resultado).
4. ~~**Comunicación manual no se persiste.**~~ ✅ Resuelto 2026-06-24 — `POST /casos/{id}/actualizacion` persiste el borrador como `comunicacion` (`tipo=MANUAL`, `estado=PENDIENTE_REVISION`) y lo devuelve con su id.
5. ~~**Vencimiento `completado` sin endpoint.**~~ ✅ Resuelto 2026-06-24 — `PATCH /vencimientos/{id}` con `{ "completado": true }` entra en el MVP.
6. ~~**Mecanismo CSRF sin especificar.**~~ ✅ Resuelto 2026-06-24 — double-submit cookie: backend emite `csrf_token` (no HttpOnly); frontend reenvía en `X-CSRF-Token`. Especificado en §5 de `07-seguridad-y-despliegue/seguridad-y-despliegue.md`.
7. ~~**Campos de telegrama ausentes en el modelo.**~~ ✅ Resuelto 2026-06-24 — `ramo_actividad` y `direccion_trabajo_cp/_localidad/_provincia` agregados a `ficha_laboral`; `domicilio_real_cp/_localidad/_provincia` a `cliente`. Ver DBML v2 y `08-features/generador-telegramas.md`.

### Inconsistencias menores / cosméticas

8. ~~**Numeración de RF**: no existen RF-23 ni RF-24 (hueco por retiro de reportes/facturación).~~ ✅ Resuelto 2026-06-24 — confirmado intencional: RF-23 y RF-24 fueron descartados junto con el módulo de reportes/facturación. No hay hueco pendiente.
9. ~~**Etiquetas de RF en la API**: `GET /clientes` estaba etiquetado `RF-06`.~~ ✅ Resuelto 2026-06-24 — corregido a `RF-07` en `04-api/contratos-api.md`.
10. ~~**Artefacto de heredoc** al final de `seguridad-y-despliegue.md`.~~ ✅ Resuelto 2026-06-24 — eliminado.
11. ~~**Referencias a `07-operacion/`** en `arquitectura-del-sistema.md`.~~ ✅ Resuelto 2026-06-24 — corregido a `09-operacion/`.
12. ~~**Ruta del seed** en `CLAUDE.md` (raíz) apuntaba a `docs/seeds/`.~~ ✅ Resuelto 2026-06-24 — ahora `backend/seeds/seed_etapas.sql`.

### Coherencias verificadas (OK)

- Modelo de datos ↔ reglas de negocio: estados como datos (`etapa`/`transicion_etapa`), historial
  inmutable, `tipo_reclamo` solo ART, telegrama solo Laboral, documento siempre con `subido_por`,
  comunicación con aprobación humana — todos reflejados en DBML + invariantes de servicio.
- Etapas terminales (Acuerdo / Indemnización / Sentencia) coherentes entre RN-09, diagramas y `es_terminal`.
- IA confinada a n8n y humano en el bucle: coherente en arquitectura, API (`/internal/*`), agentes-ia y RNF-04.
