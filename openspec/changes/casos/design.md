## Context

La autenticación y la infraestructura transversal ya están implementadas y archivadas: cookies JWT HttpOnly/Secure/SameSite, refresh revocable, CSRF double-submit (`CSRFMiddleware`), RBAC por dependencias (`get_current_user`, `require_roles`, `require_socio` en `core/dependencies.py`) y rate limiting (SlowAPI, `limiter`). La feature `clientes` (admisión) ya está implementada con el mismo patrón vertical-slice y es la **referencia directa** de estructura y convenciones.

Los modelos ORM del dominio **ya existen** en `backend/app/features/casos/models.py` y sus tablas están en la migración `001_esquema_base_inicial.py`: `Caso` (FK a `cliente`, `usuario`, `etapa`; `area`, `tipo_reclamo`, `codigo_expediente`, `etapa_actual_id`, `fecha_inicio`, `observaciones`), `FichaLaboral` (1:1 con `caso`, `caso_id` unique), `Etapa` (catálogo `area`+`fase`+`nombre`+`orden`+`es_terminal`, unique `(area, nombre)`), `TransicionEtapa` (`etapa_origen_id`→`etapa_destino_id`, unique) e `HistorialCaso` (`caso_id`, `etapa_anterior_id`, `etapa_nueva_id`, `evento`, `autor_id`, `ocurrido_en`). El catálogo de **18 etapas + 19 transiciones** lo carga el seed archivado `ciclo-de-vida-seed` (`backend/seeds/seed_etapas.sql` / `etapas_seed_data.py`).

Este change agrega la feature vertical-slice `features/casos/` (router/service/schemas/dependencies) que **consume** la seguridad transversal, los modelos y el catálogo de etapas sin recrearlos. No hay esquema nuevo ni migración. Enums disponibles en `shared/enums.py`: `AreaDerecho` (LABORAL/ART), `FaseCaso`, `TipoReclamoArt` (ACCIDENTE/ENFERMEDAD), `RolUsuario` (SOCIO/ABOGADO).

Restricciones: feature-first (ADR-0009), **estados como datos** (ADR-0008 — nunca enum de etapas), backend stateless, español (AR) en código y artefactos, cobertura de tests ≥ 80%, base sintética (Ley 25.326 — nunca datos reales), SQL parametrizado (SQLAlchemy).

## Goals / Non-Goals

**Goals:**
- ABM de casos: `POST /casos`, `GET /casos/{id}`, `GET /casos?filtros&page=`, `PUT /casos/{id}/ficha-laboral`.
- Máquina de estados como datos: `POST /casos/{id}/avanzar` (valida contra `transicion_etapa`, RN-04), `POST /casos/{id}/retroceder` (confirmación explícita en terminal, RN-09); ambos escriben `historial_caso` (RN-05).
- Etapa inicial del caso resuelta como dato (`area` + menor `orden`), no hardcodeada.
- Historial inmutable: solo lectura + append; nunca update/delete (RN-06). `GET /casos/{id}/historial`.
- `GET /casos/{id}` incluye las transiciones válidas desde la etapa actual (stepper del frontend).
- Coherencia intra-área: `etapa_actual_id` y toda transición pertenecen a la `area` del caso (RN-11); `tipo_reclamo` solo en ART.
- RBAC: lectura amplia (todo autenticado, RN-08); mutaciones ABOGADO+SOCIO.
- Frontend: completar la feature `casos/` (listado+filtros, alta+ficha, detalle con stepper avanzar/retroceder, historial).
- Tests backend ≥ 80% cubriendo creación+historial inicial, avance válido/ inválido, retroceso con/sin confirmación, inmutabilidad, filtros, RBAC y CSRF.

**Non-Goals:**
- Documentos/R2 (RF-14/15), comunicaciones IA/n8n (RF-16/18/26), telegramas (RF-25), vencimientos (RF-19/20): features aparte, fuera de alcance.
- Crear o modificar el catálogo de etapas/transiciones (lo hace el seed `ciclo-de-vida-seed`); este change solo lo lee.
- Nueva migración o cambios de esquema — los modelos y tablas ya existen.
- Borrado de casos (no hay baja en RF-08..13).
- Modelar el retroceso como filas de `transicion_etapa` (el seed define solo avances; el retroceso es lógica de aplicación, RN-09).

## Decisions

### D1 — Reutilizar los modelos existentes, no redefinirlos
La feature importa `from app.features.casos.models import Caso, FichaLaboral, Etapa, TransicionEtapa, HistorialCaso` (ya creados en `migraciones-esquema-base`). NO se crea un segundo modelo ni migración: hacerlo duplicaría las tablas en el registro de SQLAlchemy y rompería el mapeo. El change agrega solo `router.py`, `service.py`, `schemas.py` y `dependencies.py`.
- _Alternativa descartada_: redefinir los modelos en este change → colisión de tabla y doble fuente de verdad.

### D2 — Etapa inicial como DATO, no hardcodeada (ADR-0008)
Al crear un caso, la etapa inicial se resuelve consultando `etapa` filtrando por `area` y tomando el menor `orden` (la "Toma del cliente" es `orden` mínimo en ambos catálogos). NO se busca por el string `"Toma del cliente"` ni se usa un enum. Si el catálogo no está sembrado para esa área, el alta falla con un error claro (precondición operativa: correr el seed `ciclo-de-vida-seed`).
- _Alternativa descartada_: hardcodear `nombre == "Toma del cliente"` o un enum de etapas → viola ADR-0008 y rompe si el estudio renombra la etapa.

### D3 — Avance validado contra `transicion_etapa` (RN-04, RN-11)
`POST /casos/{id}/avanzar` recibe la etapa destino (`etapa_destino_id`). El servicio verifica que exista una fila en `transicion_etapa` con `etapa_origen_id = caso.etapa_actual_id` y `etapa_destino_id = <destino>`. Como las transiciones del seed son intra-área por construcción, esto garantiza RN-11. Si no existe la transición → error de dominio `TransicionInvalida` → **409**. En éxito: actualiza `caso.etapa_actual_id` e inserta `HistorialCaso(evento="avance", ...)` en la **misma transacción** (RN-05).
- _Alternativa_: aceptar solo "siguiente etapa" implícita → el grafo tiene bifurcaciones (p. ej. `Telegrama 1→Telegrama 2` o `→Conciliación`), así que el destino debe ser explícito y validado.

### D4 — Retroceso como lógica de aplicación con confirmación (RN-09)
El seed NO modela retrocesos como transiciones. `POST /casos/{id}/retroceder` recibe `etapa_destino_id` y `confirmar: bool`. Reglas: el destino debe ser una etapa de la **misma área** (RN-11) y debería ser una etapa de `orden` anterior; si el caso está en etapa **terminal** (`etapa.es_terminal`), el retroceso **requiere** `confirmar = true` (RN-09) → sin confirmación responde **409** (o **422** si falta el campo). En éxito: actualiza la etapa e inserta `HistorialCaso(evento="retroceso", ...)`. El retroceso valida coherencia de área pero NO consulta `transicion_etapa` (esta solo describe avances).
- _Alternativa descartada_: permitir retroceso libre sin confirmación → viola RN-09; permitir cruzar área → viola RN-11.

### D5 — Historial inmutable (append-only) (RN-05, RN-06)
Todo cambio de etapa (creación, avance, retroceso) inserta una fila en `historial_caso` con `etapa_anterior_id` (NULL en la creación), `etapa_nueva_id`, `evento`, `autor_id = current_user.id` y `ocurrido_en`. El `service` expone únicamente lectura (`listar_historial`, orden cronológico por `ocurrido_en`/`id`) e inserción interna; **no** hay función de update ni delete sobre `HistorialCaso`. La inserción del historial ocurre en la misma transacción que el cambio de etapa para que nunca queden inconsistentes.
- _Alternativa descartada_: trigger de DB para historial → añade complejidad; la política append-only por servicio es suficiente y testeable, y mantiene la lógica en un solo lugar.

### D6 — Creación de caso transaccional con ficha anidada (RF-08, RF-09)
`crear_caso` (1 transacción): valida cliente y abogado existentes; valida `tipo_reclamo` (obligatorio/permitido solo en ART, NULL en LABORAL); resuelve etapa inicial (D2); inserta `Caso`; si viene `ficha_laboral`, inserta `FichaLaboral` (1:1); inserta la primera fila de `historial_caso` (`etapa_anterior_id = NULL`, `evento = "creación"`). `PUT /casos/{id}/ficha-laboral` hace upsert de la ficha (crea si no existe, actualiza si existe; respeta el unique `caso_id`).
- _Alternativa descartada_: crear el caso y la ficha en endpoints separados obligatorios → el contrato de API permite la ficha anidada y diferible; se respeta.

### D7 — RBAC: lectura amplia, mutaciones ABOGADO+SOCIO
`GET /casos`, `GET /casos/{id}`, `GET /casos/{id}/historial` usan solo `Depends(get_current_user)` (lectura amplia para todo autenticado, RN-08). `POST /casos`, `PUT /casos/{id}/ficha-laboral`, `POST /casos/{id}/avanzar` y `POST /casos/{id}/retroceder` usan `Depends(require_roles(RolUsuario.SOCIO, RolUsuario.ABOGADO))`. Se reutilizan los guards de `core/dependencies.py` (mismo patrón que `clientes`); no se crea lógica de RBAC nueva.

### D8 — CSRF y rate limiting heredados, sin código nuevo
El `CSRFMiddleware` intercepta toda mutación bajo `/api/v1`, así que `POST`/`PUT` de casos quedan protegidos automáticamente (header `X-CSRF-Token` debe coincidir con la cookie `csrf_token`). Las rutas aplican `@limiter.limit("100/minute")` siguiendo el patrón de `clientes/router.py` (param `request: Request`). `GET` queda exento de CSRF (método seguro). Cierre con la skill `seguridad-endpoint` por endpoint.

### D9 — Filtros de listado por área/etapa/abogado/cliente con paginación (RF-13)
`GET /casos?area=&etapa=&abogado_id=&cliente_id=&page=` aplica los filtros provistos (todos opcionales y combinables) con SQL parametrizado (SQLAlchemy) y pagina por `page` (offset/limit con tamaño fijo). `etapa` puede filtrarse por `etapa_actual_id` (o por nombre dentro del área si el frontend lo prefiere; se decide `etapa_id` para evitar ambigüedad entre áreas, RN-11). La respuesta es una lista de `CasoResponse` (resumen) siguiendo el patrón de listado de `clientes`.

### D10 — Schemas Pydantic separados de entrada y salida
`CasoCreate` (`cliente_id`, `abogado_responsable_id`, `area` obligatorios; `tipo_reclamo`, `codigo_expediente`, `fecha_inicio`, `observaciones`, `ficha_laboral` opcionales), `FichaLaboralUpsert` (todos los campos de la ficha, opcionales), `AvanzarRequest` (`etapa_destino_id`), `RetrocederRequest` (`etapa_destino_id`, `confirmar: bool = False`), `CasoResponse` / `CasoDetalleResponse` (incluye etapa actual, ficha y `transiciones_validas`) e `HistorialItemResponse`. `model_config = {"from_attributes": True}` en los de salida. Validación de `tipo_reclamo` según área con validador de Pydantic o en el servicio (D6).

### D11 — Frontend: completar la feature vertical-slice casos
`frontend/src/features/casos/` con `api.ts` (sobre `shared/http`, que inyecta CSRF y `credentials:'include'`), `types.ts`, `hooks/` (p. ej. `useCasos`, `useCaso`), `components/` (formulario de alta con selección de cliente/área/ficha; tabla con filtros; stepper de etapas con avanzar/retroceder y modal de confirmación; timeline de historial) y las páginas ya existentes (`CasosPage`, `NuevoCasoPage`, `CasoLaboralPage`, `CasoARTPage`). El stepper consume `transiciones_validas` del detalle (nunca hardcodea etapas). Mensajes en español (AR); manejo de `409` (transición inválida / retroceso sin confirmar), `404` y `422`. Rutas ya montadas en `app/App.tsx` con `RequireAuth`.

## Risks / Trade-offs

- **[Tentación de hardcodear la etapa inicial o un enum de estados]** → Se resuelve por dato (`area` + menor `orden`) y se valida en code review con la skill `etapas-y-transiciones` (D2). Ninguna constante de nombres de etapa en backend ni frontend.
- **[Caso creado sin catálogo sembrado]** → Si `etapa` no tiene filas para el área, el alta falla con error claro; el seed `ciclo-de-vida-seed` es precondición operativa (documentado en CLAUDE.md / comando de seeds).
- **[Inconsistencia etapa/historial ante fallo parcial]** → El cambio de etapa y su fila de historial se escriben en la **misma transacción** (D5); si una falla, ambas se revierten.
- **[Retroceso que cruce área o salte a etapa arbitraria]** → El servicio valida que el destino sea de la misma área del caso (RN-11) y exige confirmación en terminal (RN-09) (D4).
- **[Confidencialidad Ley 25.326]** → Datos sintéticos en dev/tests; nunca datos reales ni en commits. No loguear datos personales del cliente ni de la ficha.
- **[Posible desvío menor del contrato de API]** → Si la implementación ajusta nombres de campos o códigos respecto a `docs/04-api/contratos-api.md`, se alinea el contrato en el mismo PR (regla SDD) y se registra en `docs/changemap.md`.

## Migration Plan

- No hay migración de esquema: las tablas y modelos ya existen (migración `001`). Precondición operativa: correr el seed `psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql` (o el seed Python en tests) para poblar `etapa`/`transicion_etapa` antes de crear casos. Rollback: revertir el código de la feature; no hay cambios de datos estructurales que deshacer.

## Open Questions

- ¿`GET /casos` debe devolver metadata de paginación (total/páginas) o lista simple? Se sigue el patrón de listado de `clientes`; si no hay uno establecido, offset/limit con `page`.
- ¿El filtro `etapa` del listado se expresa por `etapa_id` o por nombre+área? Decisión MVP: `etapa_id` (sin ambigüedad entre áreas). Revisar si el frontend prefiere nombre.
- ¿El retroceso debe restringirse a la etapa inmediatamente anterior o permitir cualquier etapa anterior de la misma área? Decisión MVP: misma área + confirmación en terminal (RN-09/RN-11); la granularidad exacta se valida con el estudio si surge.
