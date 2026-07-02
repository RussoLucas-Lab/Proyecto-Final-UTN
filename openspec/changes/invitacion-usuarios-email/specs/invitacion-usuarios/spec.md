## ADDED Requirements

### Requirement: Creación de invitación por email (solo SOCIO)
El sistema SHALL exponer `POST /api/v1/invitaciones` restringido al rol **SOCIO** (RF-27, RF-03) para invitar a una persona por email. El cuerpo SHALL validarse con Pydantic e incluir `nombre`, `email`, `rol` y `area` (con la misma coherencia rol/área que el alta: ABOGADO requiere área, SOCIO permite área nula). El endpoint SHALL crear el usuario en estado de cuenta **INVITED** (sin contraseña utilizable), generar un token de activación seguro, persistir **solo el hash** del token, armar el enlace de activación con la URL base configurable (`APP_BASE_URL`/`FRONTEND_URL`) y hacer un `POST` al webhook de n8n para el envío del correo. La mutación SHALL estar protegida por CSRF double-submit y rate limiting. La respuesta SHALL ser **genérica** y NUNCA SHALL revelar si el email ya existía.

#### Scenario: SOCIO invita a un email nuevo
- **WHEN** un SOCIO hace `POST /invitaciones` con cookie de sesión válida, CSRF válido y datos completos para un email no registrado
- **THEN** el sistema crea el usuario en estado **INVITED**, genera el token, guarda solo su hash, dispara el `POST` al webhook de n8n y responde con un mensaje genérico de éxito (sin `password_hash` ni el token en claro en el cuerpo)

#### Scenario: ABOGADO intenta invitar
- **WHEN** un usuario con rol ABOGADO hace `POST /invitaciones`
- **THEN** el sistema responde `403` y no crea invitación ni usuario

#### Scenario: Petición sin sesión
- **WHEN** se hace `POST /invitaciones` sin cookie de access token válida
- **THEN** el sistema responde `401`

#### Scenario: Mutación sin CSRF
- **WHEN** un SOCIO hace `POST /invitaciones` sin el header `X-CSRF-Token` o con un valor que no coincide con la cookie
- **THEN** el sistema responde `403` sin crear invitación

#### Scenario: Payload inválido
- **WHEN** un SOCIO hace `POST /invitaciones` con email mal formado o campos requeridos faltantes
- **THEN** el sistema responde `422`

### Requirement: Unicidad de invitación activa (RN-24 / RN-INV-001)
El sistema SHALL permitir como máximo **una invitación activa** por usuario. Cuando un SOCIO genere una nueva invitación para un email que ya tiene una invitación pendiente vigente, el sistema SHALL **invalidar automáticamente** la invitación anterior (marcándola `SUPERSEDED`), generar un nuevo token y disparar un nuevo envío. El token anterior NUNCA SHALL seguir siendo válido tras el reenvío.

#### Scenario: Reenvío invalida la invitación anterior
- **WHEN** un SOCIO hace `POST /invitaciones` para un email que ya tiene una invitación PENDING vigente
- **THEN** el sistema marca la invitación previa como `SUPERSEDED`, crea una nueva con un token nuevo y dispara un nuevo correo

#### Scenario: El token viejo deja de ser válido
- **WHEN** existe una invitación superseded y alguien intenta activar con su token anterior
- **THEN** el sistema responde con el mensaje genérico de invitación inválida y no activa la cuenta

### Requirement: No invitar usuarios activos (RN-25 / RN-INV-002)
El sistema NO SHALL generar invitaciones para usuarios cuyo estado de cuenta sea **ACTIVE**. Ante ese caso el sistema SHALL responder de forma **genérica** (sin confirmar la existencia ni el estado de la cuenta) y NO SHALL emitir un nuevo token ni correo. A nivel de producto, la vía para un usuario ACTIVE que perdió sus credenciales es el mecanismo de recuperación de contraseña.

#### Scenario: Invitación a un usuario ya activo
- **WHEN** un SOCIO hace `POST /invitaciones` para un email cuyo usuario está en estado ACTIVE
- **THEN** el sistema responde con el mensaje genérico y no crea una nueva invitación ni token, ni dispara correo

### Requirement: Token de activación seguro
El token de activación SHALL generarse con al menos **256 bits de entropía** mediante `secrets.token_urlsafe`. El sistema SHALL persistir **únicamente el hash** del token (nunca el valor en claro). El token SHALL ser de **un solo uso** y SHALL tener una **expiración configurable en el rango 24–72 horas** (`INVITATION_TOKEN_TTL_HOURS`). El token en claro SHALL viajar exclusivamente dentro del enlace del correo y NUNCA SHALL registrarse en logs ni almacenarse.

#### Scenario: Token consumido no se reutiliza
- **WHEN** un token de invitación ya fue usado para activar una cuenta y se intenta activar de nuevo con el mismo token
- **THEN** el sistema responde con el mensaje genérico de invitación inválida y no realiza cambios

#### Scenario: Token expirado
- **WHEN** se intenta activar con un token cuya expiración ya pasó
- **THEN** el sistema responde con el mensaje genérico de invitación inválida y no activa la cuenta

#### Scenario: Solo se persiste el hash
- **WHEN** se genera una invitación
- **THEN** en la base de datos queda almacenado el hash del token y nunca el token en claro

### Requirement: Activación de cuenta desde invitación
El sistema SHALL exponer `POST /api/v1/invitaciones/activar` como endpoint **público** (el invitado aún no tiene sesión) para validar el token y que el usuario fije su contraseña. El cuerpo SHALL validarse con Pydantic (token + contraseña acorde a la política de contraseñas). Ante un token válido, vigente y no usado, el sistema SHALL fijar la contraseña hasheada (bcrypt/argon2, nunca en texto plano), pasar el usuario a estado **ACTIVE** y marcar la invitación como consumida. Ante cualquier token inválido/expirado/usado, el sistema SHALL responder con un **mensaje genérico** ("Si la invitación es válida…") sin filtrar información. El endpoint SHALL tener **rate limiting reforzado** para mitigar fuerza bruta.

#### Scenario: Activación exitosa
- **WHEN** un invitado hace `POST /invitaciones/activar` con un token válido, vigente y no usado, y una contraseña que cumple la política
- **THEN** el sistema fija la contraseña hasheada, pasa el usuario a **ACTIVE**, marca la invitación como consumida y responde éxito

#### Scenario: Token inválido, expirado o usado
- **WHEN** un invitado hace `POST /invitaciones/activar` con un token inexistente, expirado, superseded o ya usado
- **THEN** el sistema responde con el mensaje genérico de invitación inválida y no activa ninguna cuenta

#### Scenario: Contraseña débil
- **WHEN** un invitado hace `POST /invitaciones/activar` con un token válido pero una contraseña que no cumple la política
- **THEN** el sistema responde `422` y no activa la cuenta

#### Scenario: Rate limiting en activación
- **WHEN** se hacen múltiples intentos de activación por encima del límite configurado desde el mismo origen
- **THEN** el sistema responde `429` sin revelar validez de los tokens probados

### Requirement: Validación de token para el frontend
El sistema MAY exponer `GET /api/v1/invitaciones/validar?token=…` para que la pantalla de activación determine si debe mostrar el formulario. Este endpoint SHALL responder con un **mensaje genérico** (válida / no válida) sin exponer datos del usuario ni distinguir motivos, y SHALL respetar el mismo rate limiting reforzado. Al ser `GET`, está exento de CSRF.

#### Scenario: Consulta de token válido
- **WHEN** el frontend hace `GET /invitaciones/validar?token=…` con un token vigente y no usado
- **THEN** el sistema responde que la invitación es válida sin exponer datos sensibles del usuario

#### Scenario: Consulta de token inválido
- **WHEN** el frontend hace `GET /invitaciones/validar?token=…` con un token inválido, expirado o usado
- **THEN** el sistema responde de forma genérica que la invitación no es válida, sin revelar el motivo

### Requirement: Envío del correo delegado a n8n + Resend
El backend NUNCA SHALL enviar el correo directamente ni implementar lógica SMTP; SHALL hacer un `POST` al webhook de n8n (`/webhook/email/invitation`) con el payload `{ email, name, role, activationLink }`, donde `activationLink` ya viene armado con la URL base configurable. La llamada SHALL autenticarse con el header **`X-Internal-Secret`** (mismo patrón que WF-01/WF-02). El workflow `WF-06` de n8n SHALL construir el HTML y enviarlo mediante **Resend**, con la API key y el dominio remitente como **credencial/secreto de n8n** (nunca hardcodeados en el nodo ni en el JSON versionado).

#### Scenario: Backend delega el envío
- **WHEN** se crea una invitación válida
- **THEN** el backend hace `POST` al webhook de n8n con el payload y el header `X-Internal-Secret`, y no realiza ningún envío SMTP propio

#### Scenario: Webhook autenticado
- **WHEN** llega una petición al webhook de invitación sin el `X-Internal-Secret` correcto
- **THEN** el workflow rechaza la petición y no envía correo

#### Scenario: Secreto de Resend fuera del nodo
- **WHEN** se revisa el JSON versionado de `WF-06`
- **THEN** no contiene la API key de Resend ni el `X-Internal-Secret` en texto plano; ambos se resuelven desde credenciales/env vars

### Requirement: Pantalla de activación en el frontend
El frontend SHALL ofrecer una ruta **pública** `/activate?token=…` (fuera del layout autenticado) donde el invitado fija su contraseña. La pantalla SHALL consumir los endpoints de invitación a través del cliente HTTP compartido (`credentials: 'include'` y reenvío de `X-CSRF-Token` cuando corresponda). Además, la pantalla de gestión de usuarios (solo SOCIO) SHALL incluir una acción **"Invitar usuario"** que consuma `POST /invitaciones`.

#### Scenario: Invitado abre el enlace de activación
- **WHEN** un invitado navega a `/activate?token=…` con un token válido
- **THEN** el frontend muestra el formulario para definir la contraseña y, al enviarlo, llama a `POST /invitaciones/activar`

#### Scenario: Enlace con token inválido
- **WHEN** un invitado navega a `/activate?token=…` con un token inválido o expirado
- **THEN** el frontend muestra un mensaje genérico de invitación no válida sin exponer detalles

#### Scenario: SOCIO invita desde gestión de usuarios
- **WHEN** un SOCIO usa la acción "Invitar usuario" en la pantalla de gestión de usuarios
- **THEN** el frontend llama a `POST /invitaciones` con CSRF y muestra el resultado genérico
