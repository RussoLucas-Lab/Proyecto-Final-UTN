## Why

El abogado necesita mantener informado al cliente sobre el avance de su caso, pero redactar cada actualización a mano es lento y propenso a errores de tono. Iuris ya tiene la tabla `comunicacion` y el agente n8n WF-01 especificados, pero falta el flujo que conecta el caso con la IA y persiste el borrador. Sin esto, no hay forma de generar ni guardar una actualización asistida, y toda comunicación queda fuera de traza. Este change implementa el flujo **individual** (un caso a la vez), respetando la regla no negociable de que **nada se envía solo** (RN-10).

## What Changes

- **`POST /casos/{id}/actualizacion`** (endpoint de usuario): dispara la generación del borrador vía webhook a n8n (WF-01), persiste el resultado como `comunicacion` (`tipo=MANUAL`, `estado=PENDIENTE_REVISION`) y lo devuelve con su `id`. **No envía nada.** Devuelve `503` si el servicio de IA no está disponible (habilita la redacción manual).
- **`GET /internal/casos/{id}/contexto`** (endpoint interno, herramienta del agente n8n): de solo lectura, devuelve únicamente datos seguros del caso (cliente, etapa, últimas novedades). No accesible desde el frontend; protegido por **secreto compartido** server-to-server (no usa la cookie JWT de usuario).
- **Nuevo esquema de auth `/internal/*`**: dependencia `verify_internal_secret` (header con secreto compartido) y exención de CSRF para el prefijo `/internal` — los llama n8n, no un navegador.
- **n8n WF-01**: workflow JSON disparado por webhook desde el backend; el nodo AI Agent usa la herramienta `obtener_contexto_caso` (→ `GET /internal/casos/{id}/contexto`) y devuelve el borrador al backend.
- **Frontend**: botón "Generar actualización" en el detalle de caso, editor del borrador (RF-17) y estado visible `PENDIENTE_REVISION`; mensaje claro de que el envío al cliente es manual (RF-18).
- **Backend SIN IA** (ADR-0003): no se agregan LLM, claves de OpenAI ni prompts al backend ni al frontend.
- Marcar RF-16/RF-17/RF-18 como hechos en `docs/changemap.md`.

**Fuera de alcance (otro change):** batch de 15 días (RF-26 / WF-05), dashboard de revisión batch y los endpoints `/internal/casos/pendientes-actualizacion` y `POST /internal/casos/{id}/comunicaciones`.

## Capabilities

### New Capabilities

- `comunicaciones-asistidas`: Generación, edición y persistencia de borradores de actualización al cliente asistidos por IA (n8n WF-01), siempre con revisión humana y sin envío automático (RF-16, RF-17, RF-18, UC-06, RN-10, RNF-04).

### Modified Capabilities

*(ninguna — la tabla `comunicacion` y los enums `TipoComunicacion`/`EstadoComunicacion` ya existen en la migración `001` y en `shared/enums.py`; sin cambios de esquema)*

## Impact

- **Backend**: nueva feature `features/comunicaciones/` (`schemas.py`, `service.py`, `router.py`, `dependencies.py`) sobre el `models.py` ya existente, registrada en `main.py`. Cliente HTTP saliente hacia n8n (webhook WF-01).
- **Core**: nueva config `N8N_WF01_WEBHOOK_URL` y `N8N_INTERNAL_SECRET`; nueva dependencia `verify_internal_secret`; exención de CSRF para `/internal/*` en `core/middleware.py`.
- **n8n**: nuevo `n8n/workflows/WF-01-generar-actualizacion.json`.
- **Frontend**: feature `features/comunicaciones/` (componentes de generar/editar borrador) integrada en el detalle de caso.
- **DB**: sin nueva migración (tabla `comunicacion` ya creada en `001`).
- **Dependencia externa**: n8n debe estar disponible; si no, `POST /casos/{id}/actualizacion` responde `503`.
