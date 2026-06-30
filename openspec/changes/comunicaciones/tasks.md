## 1. Core — Config y seguridad de `/internal`

- [x] 1.1 Agregar a `backend/app/core/config.py`: `N8N_WF01_WEBHOOK_URL: str` y `N8N_INTERNAL_SECRET: str` (con default de placeholder y nota de "usar secreto real, openssl rand -hex 32"). Reflejarlos en `.env.example` y en el `docker-compose.yml` (servicios backend y n8n).
- [x] 1.2 En `backend/app/core/middleware.py`, eximir de CSRF el prefijo `/api/v1/internal` (chequeo `startswith`), además de `_CSRF_EXEMPT_PATHS`. Documentar en el docstring que los `/internal/*` se protegen por secreto compartido, no por CSRF.

## 2. Backend — Schemas (feature `comunicaciones`)

- [x] 2.1 Crear `backend/app/features/comunicaciones/schemas.py` con:
  - `ActualizacionResponse` (`id: int`, `borrador: str` mapeado desde `contenido`, `generado_en: datetime`) con `model_config = ConfigDict(from_attributes=True)` y alias/validador para exponer `contenido` como `borrador`
  - `ContextoCasoResponse` (`cliente: str`, `etapa: str`, `ultimas_novedades: list[str]`)
  - (sin schema de entrada para el POST: el body es vacío; el `caso_id` viaja en la ruta)

## 3. Backend — Dependencies

- [x] 3.1 Crear `backend/app/features/comunicaciones/dependencies.py` con:
  - `verify_internal_secret`: lee el header `X-Internal-Secret`, lo compara con `settings.N8N_INTERNAL_SECRET` usando `secrets.compare_digest`; lanza `401` si falta o no coincide. NO usa `get_current_user`.
  - `get_caso_o_404(caso_id, db)`: carga el caso o lanza `404` (reutilizar el patrón de `features/casos/dependencies.py`; no importar desde otra feature — si hace falta compartir, mover a `core/`).

## 4. Backend — Service

- [x] 4.1 Crear `backend/app/features/comunicaciones/service.py` con:
  - Excepción `CasoNoEncontrado`
  - Excepción `IADisponibleError` (o `ServicioIANoDisponible`) para mapear a `503`
  - `disparar_actualizacion(caso_id, db)`: valida caso; llama al webhook `N8N_WF01_WEBHOOK_URL` con `{ "caso_id": caso_id }` (cliente HTTP con timeout configurable); ante timeout/conexión/5xx/respuesta sin texto → lanza `ServicioIANoDisponible`; con éxito persiste `Comunicacion(caso_id, contenido=<texto>, tipo=MANUAL, estado=PENDIENTE_REVISION)` y la retorna. NO ejecuta ningún envío (RN-10).
  - `obtener_contexto_caso(caso_id, db)`: valida caso; arma `{cliente, etapa, ultimas_novedades}` solo con datos seguros (sin DNI/CUIL/terceros/montos/plazos); `ultimas_novedades=[]` si no hay novedades.
- [x] 4.2 Asegurar que el cliente HTTP saliente NO contiene LLM, claves de OpenAI ni prompts (ADR-0003): solo dispara el webhook de n8n.

## 5. Backend — Router

- [x] 5.1 Crear `backend/app/features/comunicaciones/router.py` con:
  - `POST /casos/{caso_id}/actualizacion` — `Depends(get_current_user)` + `require_roles(ABOGADO, SOCIO)` + CSRF (heredado del middleware para POST) + rate limiting; llama `disparar_actualizacion`; `200` con `ActualizacionResponse`; mapea `ServicioIANoDisponible` → `503` con body claro; `CasoNoEncontrado` → `404`.
  - `GET /internal/casos/{caso_id}/contexto` — `Depends(verify_internal_secret)` (NO `get_current_user`, NO `require_roles`); llama `obtener_contexto_caso`; `200` con `ContextoCasoResponse`; `404` si no existe.
- [x] 5.2 Registrar el router en `backend/app/main.py` bajo el prefijo `/api/v1`.
- [x] 5.3 Checklist seguridad-endpoint (cierre del router): `POST /casos/{id}/actualizacion` → auth cookie + CSRF + RBAC ABOGADO/SOCIO + rate limit + Pydantic + humano-en-el-bucle (no envía). `GET /internal/.../contexto` → secreto compartido, sin cookie, GET (exento CSRF por método), datos minimizados.

## 6. Backend — Tests (cobertura ≥ 80%)

- [x] 6.1 Crear `backend/tests/features/comunicaciones/conftest.py` con: `mock_db`, fixture de DB in-memory (SQLite) con `usuario`/`refresh_token`/`etapa`/`caso`/`comunicacion` y un caso con abogado, `client` (TestClient con `dependency_overrides` de `get_db`), y un fixture/monkeypatch para mockear el cliente HTTP a n8n.
- [x] 6.2 `test_service.py` (unitarios con mock): `disparar_actualizacion` éxito → crea `tipo=MANUAL`, `estado=PENDIENTE_REVISION`; webhook caído/timeout → lanza `ServicioIANoDisponible` y NO persiste; caso inexistente → `CasoNoEncontrado`; `obtener_contexto_caso` → forma correcta y `ultimas_novedades=[]` sin novedades; verificar que el contexto NO incluye campos sensibles.
- [x] 6.3 `test_router.py` (integración TestClient):
  - `POST /casos/{id}/actualizacion` con n8n mockeado OK → `200` + fila persistida
  - n8n mockeado caído → `503` y sin persistencia
  - sin cookie → `401`; sin/!= CSRF → `403`; rol insuficiente → `403`; caso inexistente → `404`
  - `GET /internal/casos/{id}/contexto` con secreto válido y SIN cookie → `200`; sin secreto / secreto inválido → `401`; caso inexistente → `404`

## 7. n8n — Workflow WF-01

- [x] 7.1 Crear `n8n/workflows/WF-01-generar-actualizacion.json` con: Webhook Trigger (recibe `{caso_id}` desde el backend) → AI Agent (OpenAI, credencial `IA_API_KEY`, system message de `docs/03-arquitectura/agentes-ia.md`) con HTTP Request Tool `obtener_contexto_caso` apuntando a `GET {{$env.BACKEND_URL}}/internal/casos/{caso_id}/contexto` (header con `N8N_INTERNAL_SECRET`) → nodo Respond to Webhook devolviendo solo el texto del borrador.
- [x] 7.2 Verificar que la credencial de OpenAI y el secreto interno son credenciales/variables de n8n (nunca hardcodeadas en el JSON ni commiteadas).

## 8. Frontend — Feature `comunicaciones`

- [x] 8.1 Crear `frontend/src/features/comunicaciones/types.ts` (`Actualizacion`/`Borrador` alineado a `ActualizacionResponse`) y `api.ts` (`generarActualizacion(casoId)` usando el cliente HTTP de `shared/` con credentials + CSRF; sin `fetch` crudo).
- [x] 8.2 Crear `frontend/src/features/comunicaciones/hooks/` (hook de generación con estados loading/error/`503`) y `components/` con el editor del borrador: `<textarea>` editable (RF-17), badge `PENDIENTE_REVISION`, y texto explícito "El envío al cliente es manual — no se envía solo" (RF-18, RN-10). Ante `503`: aviso + textarea vacío para redacción manual.
- [x] 8.3 Integrar el botón "Generar actualización" y el editor en el detalle de caso (`CasoARTPage` / `CasoLaboralPage`), sin crear router paralelo (enganche en el router de `src/app/` si hace falta una ruta).

## 9. Docs / Trazabilidad

- [x] 9.1 Actualizar `docs/changemap.md`: marcar RF-16 / RF-17 / RF-18 como hechos (✅) con referencia al change `comunicaciones`. Confirmar que el contrato de `docs/04-api/contratos-api.md` coincide con lo implementado (si diverge, gana la spec o se actualiza la spec en el mismo PR).
- [x] 9.2 Verificar build/lint y cobertura ≥ 80% antes de cerrar; smoke test manual con n8n local (borrador OK) y con n8n apagado (`503`).
