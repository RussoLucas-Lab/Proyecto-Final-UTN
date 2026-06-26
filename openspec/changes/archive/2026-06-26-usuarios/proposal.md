## Why

El estudio necesita administrar a su propio personal (abogados y socios) desde la plataforma: dar de alta nuevos profesionales, corregir sus datos y desactivar cuentas cuando alguien deja de operar. Hoy existe la autenticación (login/refresh/logout, RBAC, CSRF) pero **no hay forma de crear ni mantener usuarios** salvo cargándolos a mano en la base. RF-03 y RN-07 exigen que esta gestión sea una función del rol SOCIO, y UC-13 ya define el flujo. Sin este ABM no se puede operar el alta de cuentas en producción.

## What Changes

- **ABM de usuarios para el rol SOCIO** (RF-03, RN-07, UC-13), sobre la tabla `usuario` ya existente (migración `001`): no se crea esquema nuevo.
  - `GET /usuarios` — listar usuarios del estudio (lectura amplia para todo usuario autenticado, RN-08).
  - `POST /usuarios` — alta de usuario (nombre, email, rol, área, matrícula, contraseña inicial). **201**; **409** si el email ya existe.
  - `PUT /usuarios/{id}` — editar datos del usuario (nombre, rol, área, matrícula).
  - `PATCH /usuarios/{id}` — activar/desactivar (baja lógica `activo = true/false`), nunca delete físico.
- **Reutiliza los guards de auth** (`get_current_user`, `require_socio`, CSRF middleware, rate limiting, hashing bcrypt). No se reimplementa nada de seguridad ni autenticación.
- Las **mutaciones son exclusivas de SOCIO**; un SOCIO no puede autodesactivarse (regla de seguridad para no quedarse sin administradores).
- Frontend: nueva feature `usuarios` (solo visible/accesible para SOCIO) con listado, alta, edición y toggle de activación.
- Contraseña de alta hasheada con bcrypt (reutiliza `hash_password`); nunca se devuelve ni se loguea el hash.

## Capabilities

### New Capabilities
- `gestion-usuarios`: ABM de usuarios del estudio restringido al rol SOCIO (alta, edición, baja lógica) y lectura del listado para cualquier usuario autenticado, apoyado en la autenticación y el RBAC existentes.

### Modified Capabilities
<!-- Ninguna: este change reutiliza autorizacion-rbac y proteccion-web sin cambiar sus requisitos; solo los consume. -->

## Impact

- **Backend**: nueva feature `backend/app/features/usuarios/` (`router.py`, `service.py`, `schemas.py`, `dependencies.py`); reusa el modelo `Usuario` de `features/auth/models.py` (sin duplicarlo). Enganche del router en `app/main.py`. Reutiliza `core/dependencies.py` (`require_socio`, `get_current_user`), `core/security.py` (`hash_password`), `core/middleware.py` (CSRF) y `core/rate_limit.py`.
- **Base de datos**: ninguna migración nueva — la tabla `usuario` ya existe en `001_esquema_base_inicial.py`.
- **Frontend**: nueva feature `frontend/src/features/usuarios/` (`api.ts`, `types.ts`, `components/`, `hooks/`, `pages/`); ruta protegida solo-SOCIO en el router de `app/`.
- **API**: agrega `GET/POST /usuarios`, `PUT/PATCH /usuarios/{id}` bajo `/api/v1` (ya documentados en `docs/04-api/contratos-api.md`).
- **Changemap**: marca la fila RF-03 (feature `usuarios`) como en progreso/hecha.
- **Sin impacto** en IA/n8n, ciclo de vida de casos, ni en el contrato de auth.
