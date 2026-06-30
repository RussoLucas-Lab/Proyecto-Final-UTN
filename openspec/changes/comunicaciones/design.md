## Context

La tabla `comunicacion` ya existe (migración `001`) y su modelo ORM está en `backend/app/features/comunicaciones/models.py` (único archivo de la feature por ahora). Los enums `TipoComunicacion` (`ACTUALIZACION_AUTOMATICA | MANUAL`) y `EstadoComunicacion` (`PENDIENTE_REVISION | APROBADO | DESCARTADO`) están en `backend/app/shared/enums.py`. El contrato está en `docs/04-api/contratos-api.md` (sección "Comunicación asistida por IA") y el agente en `docs/03-arquitectura/agentes-ia.md` (WF-01).

Iuris delega toda la IA a n8n (ADR-0002, ADR-0003, ADR-0006): el backend **no** contiene LLM, claves de OpenAI ni prompts. El backend solo dispara un webhook hacia n8n y expone una herramienta de solo lectura (`/internal/casos/{id}/contexto`) que el AI Agent consume. La auth de usuario es por cookie JWT + CSRF double-submit por middleware global (`core/middleware.py`), con `_CSRF_EXEMPT_PATHS`. **No existe todavía** ningún endpoint `/internal` ni esquema de secreto compartido: este change lo introduce.

Alcance acotado a **RF-16/17/18** (flujo individual P0). El batch (RF-26 / WF-05) y sus endpoints internos quedan para otro change.

## Goals / Non-Goals

**Goals:**
- `POST /casos/{id}/actualizacion`: disparar WF-01, persistir el borrador como `comunicacion` (`tipo=MANUAL`, `estado=PENDIENTE_REVISION`) y devolverlo. `503` si la IA no está disponible.
- `GET /internal/casos/{id}/contexto`: herramienta de solo lectura para n8n, autenticada por secreto compartido (no por cookie de usuario), que devuelve solo datos seguros del caso.
- WF-01 en `n8n/workflows/` disparable por webhook.
- Frontend: generar y editar el borrador antes de usarlo; dejar claro que el envío al cliente es manual.
- Humano en el bucle (RN-10): el endpoint nunca envía nada; solo persiste borradores.

**Non-Goals:**
- Batch de 15 días (RF-26), dashboard de revisión, `GET /internal/casos/pendientes-actualizacion`, `POST /internal/casos/{id}/comunicaciones`.
- Aprobar/descartar borradores (`PATCH /comunicaciones/{id}`) y listar el dashboard (`GET /comunicaciones`) — pertenecen al change batch.
- Cualquier lógica de IA en backend/frontend (ADR-0003).
- Integración real de envío por WhatsApp (es acción externa y manual).
- Nueva migración de DB (tabla y enums ya existen).

## Decisions

**D1 — El backend dispara el webhook y espera la respuesta (síncrono al usuario)**
`POST /casos/{id}/actualizacion` hace una llamada HTTP saliente al webhook de WF-01 (`N8N_WF01_WEBHOOK_URL`) con `{ "caso_id": id }` y espera el borrador en la respuesta. El AI Agent de n8n, durante su ejecución, llama de vuelta a `GET /internal/casos/{id}/contexto` para armar el contexto. Cuando n8n responde con el texto, el backend lo persiste y lo devuelve. Es síncrono porque la UX de RF-16 es "presiono y reviso el borrador". Timeout configurable; ante fallo → `503`.

**D2 — `503` cuando la IA no está disponible (degradación a redacción manual)**
Si la llamada al webhook falla (timeout, conexión, n8n caído, 5xx de n8n, o respuesta sin texto utilizable), el backend responde **`503`** con un body claro, p. ej. `{ "error": "Servicio de IA no disponible", "detail": "Reintentá o redactá el borrador manualmente." }`. No se persiste ninguna `comunicacion` en ese caso. Esto cumple el contrato (RF-16) y habilita el fallback manual sin bloquear al abogado.

**D3 — Auth de `/internal/*` por secreto compartido, NO por cookie de usuario**
n8n llama server-to-server, sin navegador ni sesión. Se introduce:
- Config `N8N_INTERNAL_SECRET` (env, nunca hardcodeada; en n8n vive como credencial).
- Dependencia `verify_internal_secret` en `features/comunicaciones/dependencies.py` (o `core/`): lee un header (`X-Internal-Secret`) y lo compara con `secrets.compare_digest` contra `settings.N8N_INTERNAL_SECRET`; `401` si falta o no coincide.
- El endpoint interno **no** usa `get_current_user` ni `require_roles`.
Esto es el "caso especial" de seguridad de la skill seguridad-endpoint: los `/internal/*` tienen su propio esquema de auth.

**D4 — Exención de CSRF para `/internal/*`**
El middleware CSRF (`core/middleware.py`) valida double-submit en todas las mutaciones salvo `_CSRF_EXEMPT_PATHS`. El endpoint interno de este scope es **GET** (`/internal/casos/{id}/contexto`), que ya está exento por método. Aun así, se exime el prefijo `/internal` (chequeo `startswith("/api/v1/internal")`) para dejar el esquema listo y evitar que una futura mutación interna del batch quede accidentalmente sujeta a CSRF de navegador. La protección de esos paths es el secreto compartido (D3), no el CSRF.

**D5 — `GET /internal/casos/{id}/contexto` devuelve solo datos seguros (minimización)**
Responde exactamente lo necesario para redactar: `{ "cliente": <nombre>, "etapa": <nombre etapa actual>, "ultimas_novedades": [<strings>] }`. Sin DNI/CUIL, sin datos de terceros, sin montos ni plazos (coherente con los límites del system prompt de WF-01 y con Ley 25.326 / ADR-0004). Las "últimas novedades" se derivan de fuentes seguras ya existentes del caso (p. ej. historial de etapas / vencimientos recientes); si no hay novedades, lista vacía → el agente redacta un mensaje genérico. `404` si el caso no existe.

**D6 — `POST /casos/{id}/actualizacion` persiste `tipo=MANUAL`, `estado=PENDIENTE_REVISION`**
El borrador individual se guarda como `comunicacion` con `tipo=MANUAL` y `estado=PENDIENTE_REVISION`, `caso_id`, `contenido` (texto devuelto por n8n) y `generado_en=now()`. `aprobado_por`/`aprobado_en` quedan en `NULL` (la aprobación/descartado es del change batch). Respuesta `200` con `{ "id", "borrador", "generado_en" }` (alias de `contenido` → `borrador` en el schema de salida, como en el contrato). Así toda comunicación —manual o futura batch— queda trazada de forma uniforme.

**D7 — RBAC: generar = ABOGADO/SOCIO; lectura amplia no aplica al POST**
`POST /casos/{id}/actualizacion` es operativo → `require_roles(ABOGADO, SOCIO)` + CSRF (es POST de navegador) + cookie JWT + rate limiting + validación Pydantic. El endpoint interno NO lleva este combo (D3).

**D8 — Frontend: editor controlado del borrador antes de usarlo (RF-17/RF-18)**
El componente llama `POST /casos/{id}/actualizacion`, muestra el `borrador` en un `<textarea>` editable, indica el estado `PENDIENTE_REVISION` y un texto explícito tipo "Revisá y copiá el mensaje; el envío al cliente es manual (no se envía solo)". Ante `503`, muestra aviso y deja el textarea vacío para redacción manual. El `api.ts` usa el cliente HTTP de `shared/` (credentials + CSRF). Sin IA en el front.

## Risks / Trade-offs

- **Latencia del webhook síncrono** → un WF-01 lento bloquea la request del usuario. Mitigación: timeout configurable (p. ej. 20 s) y `503` claro; la UX muestra spinner. Si más adelante molesta, se puede pasar a async, pero RF-16 individual es interactivo.
- **Secreto compartido filtrado** → cualquiera con el header leería contexto de casos. Mitigación: secreto de alta entropía sólo en env/credencial n8n, `compare_digest`, datos minimizados (D5), y exposición sólo de datos seguros. Nunca commitear el valor.
- **Llamada de red entrante (n8n→backend) y saliente (backend→n8n) acopladas** → en dev, n8n debe poder resolver `BACKEND_URL` y el backend `N8N_WF01_WEBHOOK_URL` dentro de la red de Docker. Mitigación: documentar ambas en `.env.example` y `docker-compose`.
- **Contenido inventado por la IA** → mitigado fuera del backend por el system prompt de WF-01 (no inventar) y por D5 (contexto minimizado); el humano en el bucle (RN-10) es la red de seguridad final.
- **Doble disparo** → el usuario podría generar varios borradores manuales para el mismo caso. En el flujo individual es aceptable (cada uno queda trazado); la idempotencia es regla del batch (RN-22), fuera de alcance.

## Migration Plan

1. Sin migración de Alembic (tabla `comunicacion` y enums ya en `001` / `shared/enums.py`).
2. Core: agregar `N8N_WF01_WEBHOOK_URL` y `N8N_INTERNAL_SECRET` a `config.py` y `.env.example`; exención `/internal` en `core/middleware.py`.
3. Backend: implementar `schemas.py`, `service.py`, `dependencies.py` (incl. `verify_internal_secret`), `router.py`; registrar el router en `main.py` bajo `/api/v1`.
4. n8n: crear `WF-01-generar-actualizacion.json` (webhook trigger + AI Agent + HTTP Request Tool `obtener_contexto_caso` + nodo de respuesta).
5. Frontend: feature `comunicaciones` (`api.ts`, `types.ts`, `hooks/`, `components/`) integrada en el detalle de caso; enganche en el router de `src/app/`.
6. Tests backend (service + router, incl. rechazo por auth/rol/CSRF y caso `503`) con n8n y DB mockeados; cobertura ≥ 80%.
7. Smoke test manual: levantar n8n local, generar un borrador desde un caso, verificar persistencia `PENDIENTE_REVISION` y respuesta `503` con n8n apagado.
8. Actualizar `docs/changemap.md` (RF-16/17/18 → hechos).
