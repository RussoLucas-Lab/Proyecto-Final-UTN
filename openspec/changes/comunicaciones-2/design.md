## Context

El change `comunicaciones` (archivado en `openspec/changes/archive/2026-06-30-comunicaciones/`) implementó el flujo **individual**: `POST /casos/{id}/actualizacion` dispara WF-01, el AI Agent de n8n redacta el borrador usando la herramienta interna `GET /internal/casos/{id}/contexto`, y el backend lo persiste como `comunicacion(tipo=MANUAL, estado=PENDIENTE_REVISION)`. Dejó fuera el batch programado (RF-26).

Base reutilizable ya existente (verificado leyendo el código):
- **Modelo** `Comunicacion` (`backend/app/features/comunicaciones/models.py`) con TODAS las columnas necesarias: `caso_id`, `contenido`, `tipo`, `estado` (default `PENDIENTE_REVISION`), `generado_en`, `aprobado_por`, `aprobado_en`. Índices en `caso_id` y `estado`.
- **Enums** (`backend/app/shared/enums.py`): `TipoComunicacion.{ACTUALIZACION_AUTOMATICA, MANUAL}` y `EstadoComunicacion.{PENDIENTE_REVISION, APROBADO, DESCARTADO}` ya existen y ya están en la migración `001` (head).
- **Auth interno**: `verify_internal_secret` (timing-safe, header `X-Internal-Secret`) y `get_caso_o_404` en `dependencies.py`; el prefijo `/internal` ya está **exento de CSRF** en `core/middleware.py`. `N8N_INTERNAL_SECRET` ya está en config.
- **Estados como datos**: `Etapa.es_terminal: bool` (`casos/models.py`) permite calcular "caso activo" sin hardcodear enums (ADR-0008, RN-20). `Caso.fecha_inicio: date | None` existe (fallback de cadencia).
- **n8n**: `WF-01-generar-actualizacion.json` es el patrón de referencia; el AI Agent (OpenAI Chat Model + tool `obtener_contexto_caso`) se **reutiliza tal cual** en WF-05.
- **Frontend**: `frontend/src/features/comunicaciones/BatchPage.tsx` ya existe como pantalla de revisión de dos columnas (lista + editor), pero con datos **mock** (`ITEMS`, `DEFAULT_DRAFT`) y acciones locales. `components/EditorBorrador.tsx`, `api.ts` y `types.ts` también existen.

Conclusión: este change es **aditivo sobre una feature existente**; NO crea features nuevas, NO requiere migración de DB, NO agrega IA al backend (ADR-0003/0006).

## Goals / Non-Goals

**Goals:**
- Detectar a diario, en el backend, los casos que "vencen" para actualización (activo + cadencia 15 días + idempotencia) y exponerlos por un endpoint interno.
- Persistir borradores automáticos vía endpoint interno (`ACTUALIZACION_AUTOMATICA` / `PENDIENTE_REVISION`).
- Permitir al abogado listar, editar, aprobar y descartar borradores; aprobar reinicia la ventana de cadencia.
- Orquestar todo con WF-05 en n8n reutilizando el agente de WF-01.
- Cablear la pantalla de revisión existente a datos reales.
- Dejar RF-26 trazado en `docs/`.

**Non-Goals:**
- Envío automático al cliente (lo copia y envía el abogado por WhatsApp) — RN-10/RN-19.
- Reescribir el resto del dashboard (métricas, panel de vencimientos, refactor vertical-slice de `DashboardPage.tsx`) — eso es del change `dashboard`.
- Nuevo modelo/migración de DB, nuevo agente de IA, o mover la cadencia a n8n.
- Notificaciones/recordatorios push.

## Decisions

### D1 — La cadencia y la idempotencia viven en el backend, no en n8n
`GET /internal/casos/pendientes-actualizacion` calcula la lista de `caso_id` que vencen hoy. Un caso vence cuando se cumplen las tres condiciones (feature spec §Lógica de cadencia):
1. `Etapa.es_terminal == False` para la etapa actual del caso (RN-20).
2. No existe ninguna `Comunicacion` del caso con `tipo=ACTUALIZACION_AUTOMATICA` y `estado=PENDIENTE_REVISION` (idempotencia, RN-22).
3. Han pasado **≥15 días** desde la última `Comunicacion` `tipo=ACTUALIZACION_AUTOMATICA` `estado=APROBADO` (por `aprobado_en`, o `generado_en` como fallback); si nunca hubo, desde `caso.fecha_inicio`; si `fecha_inicio` es NULL, se usa `caso.creado_en`.
*Alternativa descartada:* calcular la cadencia en n8n con nodos Function. Rechazada: acopla reglas de negocio a n8n, dificulta testear, y contradice "el backend es dueño de los datos y reglas; n8n orquesta y genera" (ADR-0003, `backend/CLAUDE.md`).

### D2 — Reutilizar el AI Agent de WF-01 en WF-05 (no un agente nuevo)
WF-05 = Schedule Trigger diario → HTTP GET pendientes → IF (vacío ⇒ fin) / Split In Batches → **el mismo nodo AI Agent de WF-01** (OpenAI Chat Model + tool `obtener_contexto_caso` que pega a `GET /internal/casos/{id}/contexto`) → HTTP POST persistir. El secreto `X-Internal-Secret` se inyecta como credencial/variable de n8n; la clave OpenAI es la credencial existente. Nunca hardcodear secretos en el JSON; no intentar resolver `$env` dentro de un tool sub-node (patrón ya validado en WF-01) — skill `n8n-workflow`.
*Alternativa descartada:* un webhook único que reciba la lista y genere en lote dentro de un solo nodo. Rechazada: el patrón AI Agent + tool ya funciona por caso en WF-01; iterar con Split In Batches reutiliza exactamente ese nodo y mantiene el contexto por caso.

### D3 — Dos superficies de endpoints con dos modelos de auth distintos
- **Internos** (`/internal/casos/pendientes-actualizacion`, `/internal/casos/{id}/comunicaciones`): server-to-server desde n8n. Auth por `verify_internal_secret` (secreto compartido), **sin cookie JWT ni RBAC**, exentos de CSRF por el prefijo `/internal`. Coherente con el `GET /internal/casos/{id}/contexto` existente.
- **De usuario** (`GET /comunicaciones`, `PATCH /comunicaciones/{id}`): navegador. `GET` con `get_current_user` (lectura amplia, RN-08); `PATCH` con `require_roles(ABOGADO, SOCIO)` + CSRF double-submit + rate limit + validación Pydantic (estado restringido a `APROBADO`/`DESCARTADO`). Checklist `seguridad-endpoint` aplicado a cada uno.

### D4 — Aprobar reinicia la ventana de cadencia (sin columna nueva)
La "última actualización" del caso se deriva de la última `Comunicacion` `ACTUALIZACION_AUTOMATICA` `APROBADO` (su `aprobado_en`). Al hacer `PATCH ... {estado: APROBADO}` se setea `aprobado_por`/`aprobado_en=now()`, y por D1.3 la próxima ventana vence 15 días después. No se agrega ninguna columna a `caso`: la cadencia se calcula por consulta sobre `comunicacion`.

### D5 — Extender la feature `comunicaciones` existente (no crear carpetas nuevas)
Los 4 endpoints se agregan a `comunicaciones/router.py`; la lógica a `service.py`; los schemas a `schemas.py`. Sin routers paralelos ni carpetas globales (ADR-0009, skill `feature-scaffold`). El router ya está montado en `main.py` bajo `/api/v1`.

### D6 — Frontend: cablear `BatchPage.tsx` existente a datos reales
Reemplazar `ITEMS`/`DEFAULT_DRAFT` mock por una lectura de `GET /comunicaciones?estado=PENDIENTE_REVISION`; las acciones Aprobar/Descartar llaman a `PATCH`; "Copiar" mantiene el `navigator.clipboard`. Se agregan a `comunicaciones/api.ts` las funciones `listarPendientes()` y `revisarComunicacion(id, estado)`, y a `types.ts` el tipo `BorradorPendiente`. Los nombres de etapa/área vienen del backend (no hardcodear, `frontend/CLAUDE.md`).

### D7 — Schema de respuesta enriquecido para el listado
`GET /comunicaciones` resuelve `Comunicacion → Caso → Cliente` y `Caso → Etapa` y devuelve por ítem: `id`, `caso_id`, `cliente` (nombre), `area`, `etapa` (nombre), `preview` (alias de `contenido`), `estado`, `generado_en`. Sin DNI/CUIL ni montos (ADR-0004). Coherente con lo que la UI de revisión necesita mostrar.

## Risks / Trade-offs

- **[Solapamiento con el change `dashboard`]** → `dashboard` (in-progress, 0/27, sin código) reclama la capability `revision-comunicaciones` y duplica `GET/PATCH /comunicaciones` en sus tasks §1 y su consumo §5.3/§5.5. **Mitigación**: `comunicaciones-2` toma la titularidad de esos endpoints y de la UI de revisión; el orquestador debe recortar del change `dashboard` la capability `revision-comunicaciones` y las tasks §1, §3.1, §5.3, §5.5, dejándolo como consumidor. Orden: `comunicaciones-2` primero.
- **[Doble ejecución del batch / condición de carrera]** → si WF-05 corriera dos veces el mismo día, podría generar borradores duplicados. **Mitigación**: la condición de idempotencia (D1.2) filtra casos que ya tienen un `PENDIENTE_REVISION` automático; el `POST` interno además puede rechazar (409) si ya existe uno para el caso.
- **[n8n no disponible o AI Agent falla en un caso]** → un caso puede quedar sin borrador ese día. **Mitigación**: al día siguiente vuelve a aparecer como pendiente (la cadencia no avanza hasta que se aprueba); Split In Batches aísla el fallo por caso. No se persiste nada si el agente no devuelve texto (patrón de WF-01).
- **[`fecha_inicio` NULL]** → algunos casos podrían no tener `fecha_inicio`. **Mitigación**: fallback a `caso.creado_en` (D1.3).
- **[Rendimiento del cálculo de pendientes]** → el query recorre casos activos y su última comunicación. **Mitigación**: índices ya existentes en `comunicacion(caso_id)`, `comunicacion(estado)` y `caso(etapa_actual_id)`; el volumen del estudio es bajo (decenas/centenas de casos).

## Migration Plan

- **DB**: ninguna migración nueva. Verificación previa a implementar: `alembic current` = `001 (head)`; `Comunicacion` y los enums ya existen. Confirmado por lectura de `models.py`/`enums.py`.
- **Deploy**: desplegar backend con los 4 endpoints; importar `WF-05-batch-actualizaciones.json` en n8n y cargar sus credenciales (OpenAI + `N8N_INTERNAL_SECRET`, ya usadas por WF-01); activar el Schedule Trigger; desplegar frontend con `BatchPage` cableada.
- **Rollback**: desactivar el Schedule Trigger de WF-05 en n8n (deja de generar). Los endpoints de usuario son de solo lectura/estado y no envían nada; revertir el deploy del backend elimina las rutas. Ningún cambio de esquema que revertir.

## Open Questions

- **[Para el orquestador]** ¿Se recorta el change `dashboard` para que NO implemente `GET/PATCH /comunicaciones` (capability `revision-comunicaciones`) y solo consuma? Recomendado: sí, y que `comunicaciones-2` aterrice primero. (Ver Risks.)
- **Horario del Schedule Trigger de WF-05**: la feature spec sugiere ~07:00. ¿Confirmar zona horaria (America/Argentina/Buenos_Aires) y hora exacta con el estudio?
- **Preview del contenido en el listado**: ¿se envía el `contenido` completo o truncado a N caracteres? Propuesta: completo (la UI ya lo edita en un textarea); decidir en implementación si el volumen lo justifica.
