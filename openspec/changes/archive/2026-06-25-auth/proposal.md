## Why

Iuris no tiene autenticación real: el backend solo expone `GET /health` y el frontend usa un usuario mockeado (`MOCK_USER`) sin llamar a la API. Toda feature del MVP (clientes, casos, documentos, comunicaciones) depende de saber **quién** opera y con **qué rol**, y de proteger sus endpoints. Este change construye esa fundación de seguridad transversal —login, RBAC, CSRF y logout— que el resto de las features consume. (RF-01, RF-02, RF-04, RNF-01, RNF-11)

## What Changes

- **Login real (`POST /auth/login`)**: valida credenciales contra `usuario`, verifica el hash bcrypt y la cuenta activa, y emite **access token (15 min)** + **refresh token (7 días)** en cookies `HttpOnly`/`Secure`/`SameSite`. El refresh se persiste hasheado en la tabla `refresh_token` (revocable). Devuelve el perfil `{ rol, nombre }`. (RF-01, UC-01)
- **Renovación (`POST /auth/refresh`)**: emite un nuevo access token a partir del refresh cookie; rota el refresh y rechaza con **401** si está vencido o revocado.
- **Logout (`POST /auth/logout`)**: revoca el refresh token en DB, limpia las cookies y registra el evento. (RF-04)
- **RBAC transversal**: dependencias de FastAPI reutilizables (`get_current_user`, `require_socio`, `require_roles`) que validan sesión, rol (SOCIO/ABOGADO) y cuenta activa por endpoint. Son la base que después aplican todas las features. (RF-02, RNF-01)
- **CSRF double-submit**: el backend emite una cookie `csrf_token` legible por JS; un middleware/dependencia exige el header `X-CSRF-Token` coincidente en toda mutación (POST/PUT/PATCH/DELETE) y responde **403** si no coincide. (RNF-11)
- **Rate limiting + headers de seguridad transversales**: límite de ~5 intentos/min en login y headers obligatorios (nosniff, frame-options, HSTS, CSP, referrer-policy) en todas las respuestas.
- **Configuración de seguridad**: se activan en `core/config.py` las claves `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_ACCESS_EXPIRE_MINUTES`, `JWT_REFRESH_EXPIRE_DAYS`, `RATE_LIMIT`, banderas de cookie.
- **Frontend**: se reemplaza `MOCK_USER` y el `handleLogin` falso por el flujo real (`LoginPage` llama a `POST /auth/login`, `AuthContext` se hidrata desde la sesión, logout llama al backend). El cliente HTTP ya reenvía `X-CSRF-Token` (ya implementado en `shared/http.ts`).

> **No incluye**: el esquema de base de datos (`usuario` y `refresh_token` ya existen vía el change `migraciones-esquema-base`), ni la gestión de usuarios CRUD (RF-03, change `usuarios` aparte).

## Capabilities

### New Capabilities
- `autenticacion-sesion`: login con credenciales, emisión de access/refresh tokens en cookies seguras, renovación vía refresh, logout con revocación del refresh y registro del evento. (RF-01, RF-04, UC-01)
- `autorizacion-rbac`: control de acceso por rol (SOCIO/ABOGADO) y por cuenta activa, expuesto como dependencias reutilizables que protegen cualquier endpoint. (RF-02, RNF-01)
- `proteccion-web`: protección CSRF double-submit en mutaciones, rate limiting de login y headers de seguridad obligatorios en todas las respuestas. (RNF-11)

### Modified Capabilities
<!-- No hay specs existentes en openspec/specs/; este change es fundacional. -->

## Impact

- **Backend** (`backend/app/`):
  - `features/auth/`: nuevos `router.py`, `service.py`, `schemas.py`, `dependencies.py` (los modelos `Usuario`/`RefreshToken` ya existen en `models.py`).
  - `core/`: nuevo `security.py` (hashing, JWT, cookies), `dependencies.py` (RBAC, `get_db`, current user), middleware CSRF + headers, rate limiting; se amplía `config.py` con las claves JWT/rate-limit.
  - `main.py`: incluir el router de auth, registrar middlewares y el handler de rate limit.
  - Nuevas dependencias: `python-jose`/`pyjwt`, `passlib[bcrypt]` o `argon2-cffi`, `slowapi`, `python-multipart` (según corresponda).
- **Frontend** (`frontend/src/`):
  - `features/auth/`: `api.ts`, `types.ts`, hook de login; `LoginPage.tsx` pasa a usar la API real y manejar error 401.
  - `app/AuthContext.tsx`: elimina `MOCK_USER`, se hidrata desde el backend; `logout()` llama a `POST /auth/logout`.
  - `shared/http.ts`: ya reenvía CSRF y usa `credentials: 'include'` (sin cambios estructurales).
- **APIs**: nuevos `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`.
- **Seguridad/Datos**: en dev/tests se usan usuarios de base sintética; nunca credenciales reales. Backend stateless (sesión en cookies + `refresh_token` en DB).
