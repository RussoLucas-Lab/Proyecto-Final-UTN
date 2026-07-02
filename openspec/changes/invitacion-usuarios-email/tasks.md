## 1. Docs / SDD (fuente de verdad primero)

- [ ] 1.1 Agregar RF-27 (Invitación de usuarios por email) en `docs/01-requisitos/requisitos-funcionales.md`
- [ ] 1.2 Agregar RN-24 (unicidad de invitación activa, ≡ RN-INV-001) y RN-25 (no invitar ACTIVE, ≡ RN-INV-002) en `docs/01-requisitos/reglas-de-negocio.md`
- [ ] 1.3 Agregar UC-14 (Invitar usuario) y UC-15 (Activar cuenta desde invitación) en `docs/02-comportamiento/casos-de-uso.md`
- [ ] 1.4 Agregar US-09 (SOCIO invita usuarios por email) en `docs/02-comportamiento/historias-de-usuario.md`
- [ ] 1.5 Crear `docs/05-decisiones/adr/0011-resend-email.md` (Resend como proveedor de correo; secreto en n8n; dominio verificado en prod) y enlazarlo en el README de ADRs

## 2. Configuración / entorno

- [ ] 2.1 Agregar env vars: `APP_BASE_URL`/`FRONTEND_URL`, `N8N_INVITATION_WEBHOOK_URL`, `INVITATION_TOKEN_TTL_HOURS`, `INTERNAL_WEBHOOK_SECRET` (o reutilizar `N8N_INTERNAL_SECRET`) en `.env.example` y `docker-compose.yml`
- [ ] 2.2 Documentar que en local `APP_BASE_URL=http://localhost:3001` (frontend en :3001) y que el dominio NO se hardcodea

## 3. Modelo de datos y migración

- [ ] 3.1 Agregar campo `estado_cuenta` (INVITED/ACTIVE) al modelo de usuario, ortogonal a `activo`
- [ ] 3.2 Crear tabla/modelo `invitacion` (id, usuario/email, token_hash, estado PENDING/USED/SUPERSEDED/EXPIRED, expira_en, creado_en, usado_en)
- [ ] 3.3 Migración: usuarios preexistentes → estado_cuenta = ACTIVE (retrocompatibilidad)
- [ ] 3.4 Reflejar los cambios de esquema en el DBML/`docs/03-*` y en la capability `esquema-base-datos` si corresponde

## 4. Backend — feature `invitaciones` (vertical slice, ADR-0009)

- [ ] 4.1 Crear `app/features/invitaciones/` con `__init__.py`, `router.py`, `service.py`, `schemas.py`, `models.py`, `dependencies.py`
- [ ] 4.2 `models.py`: modelo SQLAlchemy `Invitacion`
- [ ] 4.3 `schemas.py`: `InvitacionCreate`, `InvitacionActivar` (token + contraseña con política), respuestas genéricas
- [ ] 4.4 `service.py`: generar token con `secrets.token_urlsafe(32)`, guardar solo el hash, armar `activationLink` con `APP_BASE_URL`
- [ ] 4.5 `service.py`: RN-24 — al reenviar, marcar invitación previa `SUPERSEDED` y emitir nueva
- [ ] 4.6 `service.py`: RN-25 — bloquear invitación a usuarios ACTIVE con respuesta genérica
- [ ] 4.7 `service.py`: cliente HTTP saliente a n8n con header `X-Internal-Secret` (patrón WF-01/WF-02); nunca envío SMTP propio
- [ ] 4.8 `service.py`: activación — validar token (vigente, no usado), fijar contraseña hasheada (bcrypt/argon2), pasar a ACTIVE, marcar invitación USED
- [ ] 4.9 Enganchar el router en `app/main.py` con prefix `/api`

## 5. Backend — seguridad de endpoints (skill seguridad-endpoint)

- [ ] 5.1 `POST /api/v1/invitaciones`: `get_current_user` + `verify_csrf` + `require_socio` + validación Pydantic; respuesta genérica
- [ ] 5.2 `POST /api/v1/invitaciones/activar`: endpoint público con rate limiting reforzado, validación Pydantic, mensaje genérico ante token inválido/expirado/usado; documentar la excepción CSRF (token de un solo uso como anti-CSRF, igual que login)
- [ ] 5.3 `GET /api/v1/invitaciones/validar` (opcional): rate limiting, mensaje genérico, exento de CSRF
- [ ] 5.4 Verificar rate limiting configurado en los endpoints públicos/sensibles
- [ ] 5.5 Confirmar que no se loguea el token en claro en ningún punto

## 6. Backend — tests (tests/ espeja features/)

- [ ] 6.1 `tests/features/invitaciones/`: happy path de creación (SOCIO)
- [ ] 6.2 Test: `POST /invitaciones` sin auth → 401; con ABOGADO → 403; sin CSRF → 403
- [ ] 6.3 Test: RN-24 reenvío invalida token anterior
- [ ] 6.4 Test: RN-25 usuario ACTIVE → respuesta genérica, sin nueva invitación
- [ ] 6.5 Test: activación exitosa pasa a ACTIVE y consume el token; token usado/expirado → mensaje genérico
- [ ] 6.6 Test: solo se persiste el hash del token (nunca el claro)
- [ ] 6.7 Cobertura ≥ 80% de la feature

## 7. n8n — WF-06 (skill n8n-workflow)

- [ ] 7.1 Crear `n8n/workflows/WF-06-invitacion-email.json`: Webhook `/webhook/email/invitation` → Validación → Set variables → HTML → Resend → Respond 200
- [ ] 7.2 Validar header `X-Internal-Secret` en el primer nodo; rechazar si no coincide
- [ ] 7.3 Configurar API key y dominio de Resend como credencial/secreto de n8n (nunca en el nodo)
- [ ] 7.4 Grep de secretos antes de commitear el JSON; re-exportar tras editar por API/UI
- [ ] 7.5 Probar con un `POST` real autenticado y verificar entrega vía Resend

## 8. Frontend — feature `invitaciones` (skill feature-scaffold)

- [ ] 8.1 Crear `src/features/invitaciones/` con `components/ hooks/ api.ts types.ts pages/`
- [ ] 8.2 `api.ts`: llamadas a `/invitaciones` y `/invitaciones/activar` usando el cliente HTTP compartido (credentials + CSRF)
- [ ] 8.3 `types.ts`: tipos alineados a los schemas del backend
- [ ] 8.4 Página pública `/activate?token=...` con formulario de contraseña; enganchar en el router de `src/app/` fuera del layout autenticado
- [ ] 8.5 Manejar token inválido/expirado con mensaje genérico en la UI
- [ ] 8.6 Agregar acción "Invitar usuario" (solo SOCIO) en la pantalla de gestión de usuarios

## 9. Cierre / verificación

- [ ] 9.1 Verificar coherencia spec ↔ código (SDD): specs, RF/RN/UC/US y ADR-0011 alineados
- [ ] 9.2 Correr suite de tests backend y lint frontend
- [ ] 9.3 Confirmar que ningún secreto quedó en texto plano (backend, `.env`, WF-06.json)
- [ ] 9.4 Recorrer checklist de seguridad-endpoint para cada endpoint nuevo
