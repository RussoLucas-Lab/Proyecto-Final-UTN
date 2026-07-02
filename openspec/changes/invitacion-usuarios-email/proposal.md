## Why

Hoy el alta de usuarios (`POST /api/v1/usuarios`) obliga al SOCIO a fijar una contraseña inicial y comunicarla por fuera del sistema, lo que es inseguro y poco práctico. Necesitamos que el SOCIO invite personas por email y que cada una defina su propia contraseña mediante un enlace de activación seguro. Alineado con ADR-0002/ADR-0003, el envío de correo se delega a **n8n + Resend**: el backend nunca habla SMTP ni arma HTML.

## What Changes

- **Nuevo flujo de invitación**: el SOCIO invita por email; el backend crea el usuario en estado **INVITED** (sin contraseña utilizable), genera un token seguro de un solo uso, guarda **solo el hash**, arma el enlace de activación con URL base configurable y hace `POST` al webhook de n8n.
- **Nuevo endpoint** `POST /api/v1/invitaciones` (solo SOCIO) para crear/reenviar invitaciones.
- **Nuevo endpoint** `POST /api/v1/invitaciones/activar` (público, rate-limited) para validar el token y que el invitado fije su contraseña, pasando el usuario a estado **ACTIVE**.
- **RN-24 (RN-INV-001 en el doc fuente) — Unicidad de invitación activa**: reenviar invalida la invitación anterior y emite una nueva.
- **RN-25 (RN-INV-002 en el doc fuente) — No invitar usuarios ACTIVE**: se rechaza; se responde de forma genérica.
- **Estados de usuario explícitos** INVITED → ACTIVE (además de la baja lógica `activo` existente).
- **Nuevo workflow n8n** `WF-06` (webhook `/webhook/email/invitation`) autenticado con `X-Internal-Secret`, que arma el HTML y envía con Resend (API key y dominio como **credencial/secreto de n8n**).
- **Nueva pantalla frontend de activación** (`/activate?token=...`) donde el invitado define su contraseña.
- **Nueva dependencia externa: Resend** como proveedor de correo — requiere **ADR-0011**.
- Seguridad: token de 256 bits (`secrets.token_urlsafe`), expiración 24–72 h configurable, un solo uso, solo hash persistido, rate limiting y mensajes genéricos para no filtrar existencia de correos.

## Capabilities

### New Capabilities
- `invitacion-usuarios`: ciclo de vida completo de la invitación por email — creación/reenvío por el SOCIO, generación y hash del token, unicidad de invitación activa (RN-24), bloqueo de invitación a usuarios ACTIVE (RN-25), validación de token y activación de cuenta, integración con el webhook de n8n y requisitos de seguridad del token.

### Modified Capabilities
- `gestion-usuarios`: el modelo de usuario incorpora el estado de cuenta **INVITED/ACTIVE**; el alta puede originarse desde una invitación (usuario sin contraseña inicial hasta activar). No se elimina el alta directa existente.

## Impact

- **Backend (FastAPI, feature-first)**: nueva feature `invitaciones/` (router, service, schemas, models, dependencies). Nueva tabla/entidad de invitaciones. Nuevo cliente HTTP saliente hacia n8n (patrón `X-Internal-Secret`, como WF-01/WF-02). Nuevas env vars (`FRONTEND_URL`/`APP_BASE_URL`, `N8N_INVITATION_WEBHOOK_URL`, `INVITATION_TOKEN_TTL_HOURS`, `INTERNAL_WEBHOOK_SECRET`).
- **n8n**: nuevo `WF-06-invitacion-email.json` con credencial de Resend.
- **Frontend (React, feature-first)**: pantalla pública `/activate`; en la pantalla de gestión de usuarios (solo SOCIO) se agrega la acción "Invitar usuario".
- **Docs (fuente de verdad, SDD)**: nuevos RF-27, RN-24/RN-25, UC-14/UC-15, US-09; nuevo ADR-0011 (Resend).
- **Dependencia externa nueva**: cuenta/dominio Resend (secreto en n8n).
