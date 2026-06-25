## 1. Configuración y dependencias

- [ ] 1.1 Ampliar `backend/app/core/config.py` con `JWT_SECRET`, `JWT_ALGORITHM` (default `HS256`), `JWT_ACCESS_EXPIRE_MINUTES` (15), `JWT_REFRESH_EXPIRE_DAYS` (7), `RATE_LIMIT`, `COOKIE_SECURE`, `COOKIE_SAMESITE`
- [ ] 1.2 Agregar dependencias a `backend/requirements.txt`: `pyjwt`, `passlib[bcrypt]`, `slowapi` (y `python-multipart` si el login lo requiere)
- [ ] 1.3 Documentar las claves nuevas en el `.env` de ejemplo / variables de entorno (sin secretos reales)

## 2. Seguridad transversal en core/

- [ ] 2.1 Crear `core/security.py`: hashing de contraseña con bcrypt (`hash_password`, `verify_password`) y hashing del refresh token (HMAC-SHA256 con el secreto)
- [ ] 2.2 En `core/security.py`: emisión/decodificación de JWT access (`create_access_token`, `decode_access_token`) y generación del refresh token + su valor CSRF
- [ ] 2.3 En `core/security.py`: helpers `set_session_cookies` (access + refresh `HttpOnly`/`Secure`/`SameSite`, `csrf_token` legible por JS) y `clear_session_cookies`, con banderas parametrizadas por config
- [ ] 2.4 Crear `core/dependencies.py`: `get_db` (sesión SQLAlchemy por request) y `get_current_user` (decodifica access cookie → usuario activo; 401 si falta/inválido/inactivo)
- [ ] 2.5 En `core/dependencies.py`: `require_roles(*roles)` y `require_socio` (403 si el rol no alcanza), reutilizables por cualquier feature
- [ ] 2.6 Crear el middleware CSRF double-submit (exime métodos seguros y `POST /auth/login`; 403 si el header `X-CSRF-Token` no coincide con la cookie `csrf_token`; loguea el evento)
- [ ] 2.7 Crear el middleware de headers de seguridad (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy`, `Strict-Transport-Security`)
- [ ] 2.8 Configurar el manejador genérico de errores (`{"error":"Internal Server Error"}` al cliente, detalle solo a logs) y un logger de seguridad que nunca registre contraseñas/tokens/datos sensibles

## 3. Feature auth (backend)

- [ ] 3.1 Crear `features/auth/schemas.py`: `LoginRequest` (email + password con validación Pydantic) y `PerfilResponse` (`rol`, `nombre`)
- [ ] 3.2 Crear `features/auth/service.py`: `autenticar` (busca usuario, verifica hash, valida `activo`), `emitir_sesion` (crea access + refresh, persiste refresh hasheado), `renovar` (valida refresh en DB, rota), `revocar` (logout)
- [ ] 3.3 Crear `features/auth/dependencies.py` con lo específico de la feature (p. ej. extracción del refresh cookie), reusando lo de `core/`
- [ ] 3.4 Crear `features/auth/router.py`: `POST /auth/login` (200 + cookies + perfil; 401 credenciales/cuenta inactiva; rate limit ~5/min)
- [ ] 3.5 En `router.py`: `POST /auth/refresh` (200 + nueva cookie access + rotación; 401 si revocado/vencido/ausente)
- [ ] 3.6 En `router.py`: `POST /auth/logout` (revoca refresh, limpia cookies, loguea evento; idempotente)
- [ ] 3.7 Aplicar el checklist de la skill `seguridad-endpoint` a cada endpoint nuevo (auth por cookie, CSRF en mutaciones salvo login, RBAC donde aplique, rate limiting, validación Pydantic)

## 4. Wiring de la app (backend)

- [ ] 4.1 En `main.py`: incluir el router de auth bajo el prefijo `/api/v1`
- [ ] 4.2 En `main.py`: registrar los middlewares (CSRF, headers de seguridad) y el limiter de SlowAPI + handler 429
- [ ] 4.3 Verificar que `GET /health` siga sin auth y que el OpenAPI (`/docs`) liste los endpoints de auth

## 5. Frontend (React)

- [ ] 5.1 Crear `features/auth/types.ts` (`Credenciales`, `Perfil`) y `features/auth/api.ts` (`login`, `logout` usando `shared/http.ts`)
- [ ] 5.2 Actualizar `features/auth/LoginPage.tsx`: `handleLogin` llama a `api.login(email, password)`, maneja 401 con mensaje claro en español, navega al dashboard al éxito
- [ ] 5.3 Actualizar `app/AuthContext.tsx`: eliminar `MOCK_USER`, hidratar el usuario desde el perfil del login (derivar iniciales), `logout()` llama a `POST /auth/logout` y limpia el estado
- [ ] 5.4 Ajustar el tipo `AuthUser` al contrato real (`{ rol, nombre }`) y confirmar que no se usa `localStorage` para el token
- [ ] 5.5 Verificar que las mutaciones reenvían `X-CSRF-Token` (ya en `shared/http.ts`) y que `credentials: 'include'` está activo

## 6. Tests y verificación

- [ ] 6.1 Seed/fixtures de usuarios sintéticos (un SOCIO y un ABOGADO activos + uno inactivo) para tests, sin datos reales
- [ ] 6.2 Tests unitarios de `core/security.py` (hash, verify, JWT emisión/expiración) y de `service.py` (autenticar, renovar, revocar)
- [ ] 6.3 Tests de integración de endpoints: login OK/401, refresh OK/401 (revocado, vencido), logout + refresh posterior 401
- [ ] 6.4 Tests de RBAC (`require_socio`: SOCIO 200, ABOGADO 403, sin sesión 401) y CSRF (mutación sin header 403, con header válido OK, método seguro exento)
- [ ] 6.5 Verificar rate limiting de login (429 al exceder ~5/min) y presencia de headers de seguridad en las respuestas
- [ ] 6.6 Asegurar cobertura ≥ 80% en service, dependencias y validadores; correr lint/format (ruff/black/isort, eslint/prettier)
- [ ] 6.7 Verificación manual del flujo end-to-end: login → navegación protegida → refresh transparente → logout → acceso bloqueado
