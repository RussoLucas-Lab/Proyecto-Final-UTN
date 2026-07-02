## Context

El alta de usuarios actual (`POST /api/v1/usuarios`, capability `gestion-usuarios`) exige que el SOCIO fije una contraseña inicial y la comunique fuera de banda. Queremos reemplazar/complementar ese flujo con una **invitación por email**: el invitado define su propia contraseña vía un enlace de activación seguro.

Restricciones del proyecto que condicionan el diseño:
- **Toda automatización de correo vive en n8n** (ADR-0002/ADR-0003). El backend no habla SMTP ni arma HTML; hace un `POST` a un webhook de n8n. El proveedor de envío es **Resend** (nuevo).
- Backend **FastAPI (Python)**, organización **feature-first / vertical slice** (ADR-0009).
- Seguridad obligatoria: JWT en cookies HttpOnly/Secure/SameSite, CSRF double-submit, RBAC (solo **SOCIO** gestiona usuarios), rate limiting, backend stateless.
- **Ambiente local por ahora**: la URL base del enlace de activación es **configurable por env var**, no hardcodeada.
- El documento fuente (`docs/indicaciones/initacion por mail.md`) es un template reusado: menciona "Backend Java", "SecureRandom" y el dominio `active-trace.com`. Todo eso se ignora; el stack real manda.

## Goals / Non-Goals

**Goals:**
- Permitir que el SOCIO invite usuarios por email; el usuario nace en estado **INVITED** sin contraseña utilizable.
- Generar un token de activación seguro (256 bits, un solo uso, expiración configurable 24–72 h), persistiendo **solo el hash**.
- Delegar el envío del correo a n8n (`WF-06`) + Resend, autenticando el webhook con `X-Internal-Secret`.
- Pantalla de activación en frontend donde el invitado fija su contraseña y pasa a **ACTIVE**.
- Implementar RN-24 (unicidad de invitación activa) y RN-25 (no invitar usuarios ACTIVE).

**Non-Goals:**
- Recuperación/olvido de contraseña (flujo separado, futuro; reutilizará la misma infra n8n+Resend).
- Otros correos transaccionales (bienvenida, cambio de email, etc.): fuera de alcance; la arquitectura queda preparada para agregarlos como workflows independientes.
- Verificación de dominio productivo en Resend (queda para prod; en local se usa el sandbox/dominio de prueba de Resend como credencial).
- Eliminar el alta directa existente de usuarios: se mantiene; la invitación es un flujo adicional.

## Decisions

### D1 — Nueva capability `invitacion-usuarios`, con delta a `gestion-usuarios`
El ciclo de vida de la invitación (token, activación, webhook, seguridad) es cohesivo y merece su propia capability `invitacion-usuarios`. Se agrega un delta a `gestion-usuarios` para introducir el **estado de cuenta INVITED/ACTIVE** en el modelo de usuario (ortogonal a la baja lógica `activo` ya existente).
- *Alternativa descartada*: meter todo dentro de `gestion-usuarios`. Se descartó porque mezcla el ABM de usuarios con la mecánica de tokens y n8n, y ensucia esa spec.

### D2 — Feature backend `invitaciones/` (vertical slice, ADR-0009)
Estructura: `app/features/invitaciones/` con `router.py · service.py · schemas.py · models.py · dependencies.py` + `tests/features/invitaciones/`. Enganche en `app/main.py` con prefix `/api`. Sin imports cruzados con `usuarios/`; lo compartido (hash de contraseña, cliente HTTP a n8n, config) vive en `core/`/`shared/`.
- El cliente HTTP saliente hacia n8n y la generación de token/hash van en `service.py`; el modelo de invitación en `models.py`.

### D3 — Endpoints y su seguridad (skill `seguridad-endpoint`)
- `POST /api/v1/invitaciones` — crear/reenviar invitación. **Auth cookie JWT** (`get_current_user`) + **CSRF double-submit** (`verify_csrf`) + **RBAC solo SOCIO** (`require_socio`) + validación Pydantic. Respuesta genérica (RN-25): no revela si el email ya existe/está activo.
- `POST /api/v1/invitaciones/activar` — validar token y fijar contraseña. Endpoint **público** (el invitado aún no tiene sesión), por eso **rate limiting reforzado** (anti fuerza bruta), validación Pydantic (token + contraseña con política de fuerza), y **mensaje genérico** ("Si la invitación es válida…") ante token inválido/expirado/usado. Es mutante → CSRF: al ser un endpoint público sin sesión previa, se protege con rate limiting + token de un solo uso en el body (el token de invitación cumple el rol anti-CSRF); documentar la excepción explícitamente como se hace con login.
- (Opcional) `GET /api/v1/invitaciones/validar?token=…` para que el frontend chequee validez antes de mostrar el form — mismo rate limiting y mensaje genérico. GET exento de CSRF.
- Cada endpoint mutante lleva su guard en la **firma** (Depends), no `if` sueltos. Tests: rechazo por falta de auth y por rol insuficiente en `POST /invitaciones`.

### D4 — Token seguro con patrón selector + verifier (DECIDIDO)
- El token entregado en el enlace tiene la forma **`<selector>.<verifier>`**, ambas partes generadas con `secrets.token_urlsafe` (entropía combinada ≥256 bits).
- **En DB** la invitación guarda: `selector` **en claro e indexado** (permite lookup O(1)) y `verifier_hash = sha256(verifier)`. **NO** se aplica argon2/bcrypt sobre el token completo, y **NO** se incluye el `id` de la invitación en el enlace.
- **Activación**: se busca la fila por `selector` (índice) y se compara `sha256(verifier)` contra `verifier_hash` en **tiempo constante** (`hmac.compare_digest`). El verifier en claro nunca se persiste.
- Expiración: `INVITATION_TOKEN_TTL_HOURS`, **default 48 h** (dentro del rango 24–72 h).
- Un solo uso: al activar, la invitación se marca `USED`/consumida y no puede reutilizarse.
- Enlace: `{APP_BASE_URL}/activate?token=<selector>.<verifier>` — `APP_BASE_URL`/`FRONTEND_URL` por env var; en local `http://localhost:3001/activate?token=...`. El token en claro solo viaja en el email, nunca se guarda.
- *Alternativa descartada*: hashear el token completo con argon2/bcrypt (sin selector) obliga a iterar filas para el lookup; el patrón selector+verifier resuelve el lookup indexado sin sacrificar seguridad.

### D5 — RN-24 / RN-25 en el service (reenvío idempotente, DECIDIDO)
- **RN-24 (unicidad de invitación activa)**: al crear una invitación para un email con invitación PENDING vigente, se **invalida** la anterior (estado `SUPERSEDED`) y se emite una nueva. A lo sumo una invitación activa por usuario.
- **Reenvío idempotente por email**: no hay endpoint dedicado de reenvío. El mismo `POST /api/v1/invitaciones` es idempotente por email: si ya existe una invitación activa para ese email, aplica RN-24 (invalida la anterior, genera un token nuevo y reenvía el correo).
- **RN-25 (no invitar ACTIVE)**: si el usuario destino ya está ACTIVE, no se crea invitación; se responde de forma genérica (sin filtrar existencia) y se sugiere, a nivel producto, el flujo de recuperación de contraseña (futuro).

### D6 — WF-06 en n8n (skill `n8n-workflow`)
- Nuevo `n8n/workflows/WF-06-invitacion-email.json`: `Webhook (/webhook/email/invitation) → Validación datos → Set variables → Construcción HTML → Nodo Resend → Respond 200`.
- **Autenticación del webhook**: el backend envía header `X-Internal-Secret` (== `N8N_INTERNAL_SECRET`/`INTERNAL_WEBHOOK_SECRET` del contenedor); el primer nodo valida ese header y corta si no coincide. Mismo patrón que WF-01/WF-02.
- **Resend**: API key y dominio remitente como **credencial/secreto de n8n**, jamás hardcodeados en el nodo. Ningún secreto en texto plano en el JSON versionado (grep antes de commitear).
- Payload backend→n8n: `{ email, name, role, activationLink }` (el enlace ya viene armado por el backend, con la URL base por env var).
- El envío es transaccional (invitación disparada por acción del SOCIO), no una comunicación al cliente del estudio → RN-10 (humano en el bucle) no aplica aquí.

### D7 — Frontend: pantalla de activación (skill `feature-scaffold`)
- Feature `src/features/invitaciones/` (`components/ hooks/ api.ts types.ts pages/`). `api.ts` usa el cliente HTTP compartido (`credentials: 'include'` + CSRF). Página pública `/activate` enganchada en el router de `src/app/` (ruta fuera del layout autenticado).
- En la pantalla de gestión de usuarios (solo SOCIO) se agrega la acción **"Invitar usuario"** que llama a `POST /invitaciones`.
- `types.ts` alineado a los schemas del backend.

### D8 — Nuevo ADR-0011 (Resend como proveedor de correo)
Incorporar Resend es una decisión arquitectónica con dependencia externa nueva → se documenta en `docs/05-decisiones/adr/0011-resend-email.md` (proveedor de correo, por qué Resend, secreto en n8n, dominio verificado en prod). Es el próximo número libre (último es 0010).

### D9 — Numeración de specs docs (alineada a la convención real)
La convención real es de dos dígitos sin namespace. Se asignan los siguientes IDs (el doc fuente los llamaba RN-INV-001/002; se mapean a la convención):
- **RF-27** — Invitación de usuarios por email (último RF es RF-26).
- **RN-24** ≡ RN-INV-001 (unicidad de invitación activa); **RN-25** ≡ RN-INV-002 (no invitar ACTIVE). Último RN es RN-23.
- **UC-14** — Invitar usuario; **UC-15** — Activar cuenta desde invitación (último UC es UC-13).
- **US-09** — Como SOCIO quiero invitar usuarios por email (última US es US-08).

## Risks / Trade-offs

- **Fuga de existencia de correos** en `POST /invitaciones` y en activación → Mitigación: respuesta siempre genérica y mismo tiempo de respuesta; nunca códigos distintos para "email existe" vs "no existe".
- **Fuerza bruta sobre el token** en activación (endpoint público) → Mitigación: token de 256 bits + rate limiting reforzado + expiración corta + un solo uso.
- **Token filtrado si se loguea la URL** → Mitigación: no loguear el token en claro; solo se persiste el hash; el token vive solo en el email.
- **CSRF en endpoint de activación público** → Mitigación: al no haber sesión previa, el propio token de invitación (secreto, un solo uso, en el body) actúa como anti-CSRF; se documenta la excepción igual que login/refresh.
- **Secreto de Resend/`X-Internal-Secret` filtrado en el JSON del workflow** → Mitigación: credencial de n8n + grep de secretos antes de commitear el `WF-06.json`.
- **Divergencia local vs prod por URL base** → Mitigación: `APP_BASE_URL`/`FRONTEND_URL` por env var, nunca hardcodear el dominio.
- **Doble estado `activo` (baja lógica) vs `INVITED/ACTIVE`** → posible confusión → Mitigación: documentar en el delta de `gestion-usuarios` que son ortogonales (INVITED/ACTIVE = ciclo de credenciales; `activo` = habilitado/deshabilitado).

## Migration Plan

1. Migración de datos: agregar campo de estado de cuenta (INVITED/ACTIVE) al modelo de usuario; usuarios existentes se marcan **ACTIVE** (retrocompatibilidad). Nueva tabla `invitacion`.
2. Desplegar backend con feature `invitaciones` y nuevas env vars (`APP_BASE_URL`/`FRONTEND_URL`, `N8N_INVITATION_WEBHOOK_URL`, `INVITATION_TOKEN_TTL_HOURS`, `INTERNAL_WEBHOOK_SECRET`).
3. Importar `WF-06` en n8n y cargar credencial de Resend; verificar webhook con un `POST` de prueba autenticado.
4. Desplegar frontend con la ruta `/activate` y la acción "Invitar usuario".
5. Rollback: como el alta directa de usuarios se mantiene, se puede desactivar la acción "Invitar" en el front y el endpoint sin romper el ABM existente.

## Resolved Decisions

Las cuatro cuestiones que estaban abiertas quedaron resueltas y se reflejan en las decisiones de arriba:

- **Hash del token → patrón selector + verifier** (ver D4): `selector` en claro e indexado + `verifier_hash = sha256(verifier)`, comparación en tiempo constante. No argon2/bcrypt sobre el token completo, no `id` de invitación en el enlace.
- **TTL → 48 h** (default de `INVITATION_TOKEN_TTL_HOURS`, dentro de 24–72 h) (ver D4).
- **Política de contraseña en activación → reutilizar la política de contraseñas existente del proyecto** (no se define una nueva); el schema Pydantic de activación aplica esa misma validación.
- **Reenvío → `POST /invitaciones` idempotente por email** (sin endpoint dedicado): si ya hay una invitación activa para ese email, aplica RN-24 (ver D5).
