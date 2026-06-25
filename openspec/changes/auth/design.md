## Context

Iuris parte de un scaffold ya migrado: las 13 tablas existen vía Alembic (change `migraciones-esquema-base`), incluidas `usuario` y `refresh_token` (`backend/app/features/auth/models.py`). El backend hoy solo expone `GET /health` (`main.py`) y `core/config.py` declara únicamente `DATABASE_URL` y `LOG_LEVEL`. El frontend usa un `MOCK_USER` en `app/AuthContext.tsx` y un `handleLogin` falso en `features/auth/LoginPage.tsx`; el cliente HTTP (`shared/http.ts`) ya está preparado para auth por cookies (`credentials: 'include'`) y double-submit CSRF (lee `csrf_token` y reenvía `X-CSRF-Token`).

Este change es la **fundación de seguridad transversal** del MVP: define los mecanismos (sesión por cookies JWT, RBAC, CSRF, rate limiting, headers) que TODAS las features posteriores consumen. Restricciones no negociables: backend stateless, hash bcrypt/argon2, tokens solo en cookies `HttpOnly`/`Secure`/`SameSite`, nada de IA en el backend, base sintética en dev/tests, organización feature-first (ADR-0009). La spec en `docs/07-seguridad-y-despliegue/` es la fuente de verdad.

## Goals / Non-Goals

**Goals:**
- Login/refresh/logout reales con tokens JWT en cookies seguras y refresh revocable en DB.
- Dependencias RBAC reutilizables (`get_current_user`, `require_socio`, `require_roles`) + `get_db`, listas para que las consuman las demás features.
- Mecanismos transversales: CSRF double-submit, rate limiting de login, headers de seguridad, manejo genérico de errores.
- Wiring del frontend al flujo real (sin `MOCK_USER`).
- Cobertura de tests ≥ 80% sobre service, dependencias y endpoints.

**Non-Goals:**
- Esquema de base de datos: `usuario` y `refresh_token` ya existen; este change NO crea migraciones de esas tablas.
- Gestión de usuarios CRUD (alta/edición/baja): es el change `usuarios` (RF-03).
- Recuperación de contraseña ("¿Olvidó su contraseña?" queda como link sin backend en este change).
- Política de complejidad de contraseña en el alta (se valida al crear usuarios, no en login).
- HTTPS/proxy reverso y CSP afinada por entorno: se setean los headers, pero la terminación TLS es de despliegue.

## Decisions

### D1 — Estrategia de tokens: JWT access (15m) + refresh opaco/JWT (7d) revocable en DB
- **Qué**: access token JWT firmado con `JWT_SECRET`/`JWT_ALGORITHM` (claims: `sub`=usuario_id, `rol`, `exp`), vida 15 min. Refresh token de larga duración (7 días) cuyo **hash** se persiste en `refresh_token` para permitir revocación; el valor en claro solo viaja en la cookie.
- **Por qué**: el access corto minimiza la ventana de robo y mantiene el backend stateless (no se consulta DB en cada request para el access). El refresh en DB habilita logout real y revocación (RF-04). Hashear el refresh evita que una filtración de la tabla exponga sesiones (igual criterio que las contraseñas).
- **Rotación**: en cada `/auth/refresh` se revoca el refresh usado y se emite uno nuevo (rotation), mitigando replay. Detección de reuse queda como mejora futura.
- **Alternativas**: (a) sesión en servidor/Redis → viola backend stateless (RNF-12) y suma infra. (b) Solo access sin refresh → fuerza re-login cada 15 min, mala UX. (c) Refresh en texto plano en DB → riesgo innecesario.
- **Librerías**: `pyjwt` (o `python-jose`) para JWT; `passlib[bcrypt]` para hashing de contraseñas (alineado con la spec bcrypt/argon2). El hash del refresh puede usar SHA-256 con sal del secreto o el mismo `passlib`.

### D2 — Cookies seguras y su emisión centralizada
- **Qué**: helpers en `core/security.py` (`set_session_cookies`, `clear_session_cookies`) que setean `access_token`, `refresh_token` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path`/`Max-Age` por config) y `csrf_token` (NO `HttpOnly`, legible por JS). Las banderas (`Secure`, `SameSite`) se parametrizan para permitir dev sin HTTPS.
- **Por qué**: una sola fuente de verdad para banderas y nombres de cookie evita inconsistencias entre login/refresh/logout. `SameSite=Lax` como default (la spec admite Strict o Lax según navegación); `Lax` es compatible con navegación normal y el double-submit cubre el resto.
- **Alternativa**: setear cookies inline en cada endpoint → propenso a olvidar una bandera.

### D3 — RBAC y sesión como dependencias FastAPI reutilizables (en `core/`)
- **Qué**: `core/dependencies.py` expone `get_db`, `get_current_user` (decodifica access cookie → usuario activo), y factories `require_roles(*roles)` / `require_socio`. Devuelven 401 (no autenticado/inactivo) o 403 (rol insuficiente).
- **Por qué**: las features se protegen declarando `Depends(...)`, sin reimplementar auth. Cumple la skill `seguridad-endpoint` y el ADR-0009 (transversal en `core/`, no imports cruzados entre features).
- **Alternativa**: lógica de auth dentro de cada router → duplicación y olvidos (justo lo que la skill busca evitar).

### D4 — CSRF double-submit vía middleware transversal
- **Qué**: middleware en `core/` que, para métodos mutantes (`POST/PUT/PATCH/DELETE`), compara el header `X-CSRF-Token` con la cookie `csrf_token`; 403 si falta o no coincide. `GET/HEAD/OPTIONS` exentos. El login emite/renueva la cookie `csrf_token`.
- **Por qué**: el frontend ya reenvía el header (`shared/http.ts`), y un middleware garantiza cobertura uniforme sin depender de que cada endpoint lo recuerde. Stateless: no requiere almacenar el token en DB.
- **Decisión de borde**: el propio `/auth/login` no exige CSRF previo (aún no hay sesión); emite la cookie. `/auth/refresh` y `/auth/logout` SÍ validan CSRF como mutaciones (el frontend ya tendrá la cookie). Esto se documenta para evitar bloquear el primer login.
- **Alternativa**: token CSRF firmado/sincronizado en servidor → más complejo y con estado; double-submit es el patrón que pide la spec (RNF-11).

### D5 — Rate limiting con SlowAPI; headers con middleware
- **Qué**: `slowapi` para limitar `/auth/login` (~5/min) y, opcionalmente, un límite global (~100/min). Un middleware agrega los headers de seguridad (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `CSP`, `HSTS`) a toda respuesta.
- **Por qué**: SlowAPI integra con FastAPI/Starlette y permite límites por ruta. Los headers como middleware aplican sin tocar endpoints.
- **Alternativa**: rate limiting en NGINX/proxy → válido en prod, pero queremos protección a nivel app también y testeable.

### D6 — Configuración: ampliar `core/config.py`
- **Qué**: agregar `JWT_SECRET`, `JWT_ALGORITHM` (default `HS256`), `JWT_ACCESS_EXPIRE_MINUTES` (15), `JWT_REFRESH_EXPIRE_DAYS` (7), `RATE_LIMIT`, `COOKIE_SECURE`, `COOKIE_SAMESITE`. Ya existe `extra="ignore"`, así que las claves del `.env` de ejemplo se incorporan sin romper.
- **Por qué**: configuración centralizada (checklist de seguridad); secretos por entorno, nunca en código.

### D7 — Frontend: reemplazar el mock por flujo real
- **Qué**: `features/auth/api.ts` (`login`, `logout`), `types.ts`; `LoginPage` llama `http.post('/auth/login', {email,password})`, maneja 401 (mensaje claro en español), y al éxito hidrata `AuthContext` con `{ rol, nombre }` derivando iniciales. `AuthContext` elimina `MOCK_USER`; `logout()` llama `POST /auth/logout` y limpia el estado. La sesión se sostiene por cookies; el frontend nunca lee el token (solo `csrf_token`).
- **Por qué**: cumple `frontend/CLAUDE.md` (auth por cookies, sin `localStorage`, lenguaje simple) y conecta la UI ya diseñada al backend real.
- **Pendiente menor**: el endpoint de login devuelve `{ rol, nombre }` (no `id`); el `AuthContext` actual espera `id`. Se ajusta el tipo `AuthUser` para no exigir `id`, o el login devuelve también `id`. Se resuelve en apply alineando el contrato con `docs/04-api`.

## Risks / Trade-offs

- **CSRF bloquea el primer login si se exige header sin cookie previa** → El middleware exime explícitamente a `POST /auth/login` de la validación CSRF (no hay sesión aún) y ese endpoint emite la cookie `csrf_token`. Documentado en D4.
- **`SameSite=Lax` vs `Strict`** → `Lax` para no romper navegación; el double-submit + cookies HttpOnly cubren el grueso del riesgo CSRF/XSS. Revisable por entorno.
- **Cookies `Secure` en dev sin HTTPS** → banderas parametrizadas (`COOKIE_SECURE`) para permitir desarrollo local; en prod SIEMPRE `Secure` + HTTPS.
- **Rotación de refresh sin detección de reuse** → un refresh robado podría usarse hasta su expiración o hasta el próximo refresh legítimo. Mitigación parcial con rotación; detección de reuse (revocar toda la cadena) queda como mejora futura.
- **Elección JWT lib (`pyjwt` vs `python-jose`)** → se decide en apply; ambas válidas, `pyjwt` es más liviana. No bloquea el diseño.
- **Desfase de contrato `id` en el perfil** → el contrato de `docs/04-api` devuelve `{ rol, nombre }`; el frontend mock asume `id`. Se alinea en apply (ver D7).

## Migration Plan

1. Ampliar `core/config.py` con las claves JWT/cookie/rate-limit; agregar dependencias a `requirements.txt` (`pyjwt`, `passlib[bcrypt]`, `slowapi`).
2. Implementar `core/security.py` (hashing, JWT, cookies) y `core/dependencies.py` (`get_db`, `get_current_user`, `require_*`).
3. Implementar la feature `auth` (`schemas.py`, `service.py`, `dependencies.py`, `router.py`) y montar el router + middlewares CSRF/headers + handler de rate limit en `main.py`.
4. Cablear el frontend (`features/auth/api.ts`, `LoginPage`, `AuthContext`).
5. Tests backend (unit de service/security, integración de endpoints y RBAC/CSRF) y verificación manual del flujo login→navegación→refresh→logout.
6. **Rollback**: el change no altera el esquema (las tablas ya existían); revertir es quitar router/middlewares y restaurar el `MOCK_USER` del frontend. Sin migraciones que deshacer.

## Open Questions

- ¿Hashear el refresh con `passlib` (bcrypt, costo) o con HMAC-SHA256 (más rápido, suficiente para tokens de alta entropía)? Sugerencia: HMAC-SHA256 con `JWT_SECRET` para no pagar costo bcrypt en cada refresh. A decidir en apply.
- ¿Límite global de API (~100/min) en este change o se difiere? Sugerencia: dejar el de login (~5/min) ahora; el global puede sumarse aquí o en el proxy.
- Almacenamiento del estado de rate limit: in-memory (suficiente para un proceso/dev) vs backend compartido (Redis) cuando haya múltiples réplicas. In-memory por ahora; revisitar al escalar.
- ¿El perfil de login incluye `id` además de `{ rol, nombre }`? A confirmar contra el contrato y el uso del frontend.
