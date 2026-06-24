# Seguridad y Despliegue

Define los requisitos de seguridad, despliegue, autenticación, autorización y protección de Iuris. Estos requisitos son **obligatorios** para el backend y el despliegue. (Roles del proyecto: **SOCIO** y **ABOGADO**; ver `01-requisitos/`.)

## 1. Despliegue (Docker)

La aplicación se ejecuta íntegramente en contenedores Docker.

- Un Dockerfile por servicio: **frontend**, **backend**, **base de datos** y, opcionalmente, **proxy reverso**.
- **Docker Compose** para orquestación local.
- Variables de entorno externas (nunca secretos en el código).
- Persistencia mediante volúmenes.
- Redes privadas entre contenedores; solo el frontend (y el proxy) se exponen.

Flujo: `Frontend → Backend (API) → Base de datos`. n8n y R2 son servicios complementarios (n8n en la red privada; R2 es externo, gestionado).

### Variables de entorno (ejemplo)
```env
DATABASE_URL=
DB_USER=
DB_PASSWORD=

JWT_SECRET=
JWT_ALGORITHM=
JWT_ACCESS_EXPIRE_MINUTES=15
JWT_REFRESH_EXPIRE_DAYS=7

R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=

N8N_WEBHOOK_URL=
N8N_SHARED_SECRET=

LOG_LEVEL=
RATE_LIMIT=
```

## 2. Autenticación (JWT + Refresh)

- **Access token**: vida útil corta (sugerido **15 minutos**); autoriza peticiones.
- **Refresh token**: vida útil prolongada (sugerido **7 días**); permite renovar el access token. Se **almacena en la base** (`refresh_token`) para permitir su **revocación**.
- Tokens en **cookies seguras**: `HttpOnly`, `Secure`, `SameSite=Strict` (o `Lax` según navegación). Prohibido el acceso desde JavaScript; transmisión solo por HTTPS (protección XSS).

### Sesiones
- **Login**: validar credenciales → emitir access + refresh → almacenar refresh → enviar cookies seguras.
- **Logout**: limpiar cookies → invalidar (revocar) refresh token → registrar el evento.
- **Revocación**: tabla `refresh_token` (id, usuario_id, token, issued_at, expires_at, revoked).

## 3. Contraseñas

- Nunca en texto plano: hash con **bcrypt** o **argon2**.
- Política mínima: 8 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 carácter especial.

## 4. Autorización (RBAC)

- Roles del sistema: **SOCIO** (acceso total + gestión de usuarios) y **ABOGADO** (operativo, sin gestión de usuarios).
- Cada endpoint valida: usuario autenticado, permisos del rol y estado de la cuenta (activo).

## 5. Protección contra ataques web

- **SQL Injection**: prohibido concatenar SQL; usar consultas parametrizadas / ORM (SQLAlchemy).
- **XSS**: sanitizar entradas, escapar contenido, evitar renderizado inseguro.
- **CSRF (double-submit cookie)**: además de las cookies de sesión, el backend emite una cookie `csrf_token` **legible por JS** (no HttpOnly). El frontend lee ese valor y lo reenvía en el header `X-CSRF-Token` en toda petición mutante (POST/PUT/PATCH/DELETE). El backend rechaza (403) si el header no coincide con la cookie. Las cookies de sesión usan `SameSite` como defensa adicional.
- **Fuerza bruta / rate limiting**: login ~5 intentos/min; API ~100 req/min (p. ej. SlowAPI o rate limiting en el proxy/NGINX).

## 6. Headers de seguridad

Todas las respuestas incluyen: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin`, `Content-Security-Policy`, `Strict-Transport-Security`.

## 7. HTTPS

En producción: HTTPS obligatorio, certificados válidos, cookies `Secure`. Sin tráfico HTTP sin redirección.

## 8. Logging

- **Aplicación**: login, logout, registro de usuarios, operaciones críticas (avance de etapa, backups), errores de negocio.
- **Seguridad**: JWT inválidos, accesos denegados, exceso de intentos de login, eventos CSRF, errores de autenticación.
- **Nunca** registrar: contraseñas, tokens, secretos ni datos personales sensibles.

## 9. Manejo de errores

Los errores internos no se exponen al usuario (`{"error": "Internal Server Error"}`); el detalle va solo a los logs.

## 10. Base de datos y migraciones

- Integridad con `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `NOT NULL`, `CHECK`.
- Cambios estructurales solo por **migraciones (Alembic)**; prohibido modificar tablas a mano en producción.

## 11. Testing y observabilidad

- **Unit**: servicios, validadores, utilidades, reglas de negocio.
- **Integración**: autenticación, usuarios, roles, operaciones críticas, base de datos.
- **Cobertura** objetivo ≥ 80%.
- **Health check**: `GET /health` → `{"status":"UP"}`.
- Monitoreo: seguimiento de errores, estado de servicios, consumo de recursos, auditoría de eventos.

## 12. Requisitos no funcionales

- Rendimiento: tiempo promedio de respuesta **< 500 ms**.
- Disponibilidad objetivo: **99%**.
- **Backend stateless**: la información de sesión se externaliza (cookies + `refresh_token` en DB), no vive en memoria del backend.

## 13. Checklist obligatorio

Infraestructura: Docker · Docker Compose · variables de entorno.
Seguridad: JWT · refresh tokens revocables · cookies HttpOnly/Secure/SameSite · bcrypt/argon2 · CSRF · rate limiting · HTTPS · headers · logs de seguridad.
Calidad: Swagger/OpenAPI (FastAPI lo genera) · testing automatizado · migraciones (Alembic) · logging · health check.
Arquitectura: backend stateless · RBAC (SOCIO/ABOGADO) · persistencia desacoplada · configuración centralizada.
