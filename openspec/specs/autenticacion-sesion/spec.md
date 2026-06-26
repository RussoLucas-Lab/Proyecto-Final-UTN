## ADDED Requirements

### Requirement: Inicio de sesión con credenciales

El sistema SHALL exponer `POST /api/v1/auth/login` que recibe `{ email, password }`, valida las credenciales contra la tabla `usuario` comparando la contraseña con el hash bcrypt almacenado, y SHALL rechazar el acceso si el usuario no existe, la contraseña no coincide o la cuenta está inactiva (`activo = false`). En caso de éxito, el sistema SHALL emitir un access token (vida 15 minutos) y un refresh token (vida 7 días), entregarlos en cookies `HttpOnly`, `Secure` y `SameSite`, persistir el refresh token hasheado en la tabla `refresh_token`, y devolver el perfil `{ rol, nombre }`. (RF-01, UC-01)

#### Scenario: Credenciales válidas y cuenta activa
- **WHEN** un usuario activo envía `POST /auth/login` con email y contraseña correctos
- **THEN** el sistema responde 200 con `{ rol, nombre }`
- **AND** setea las cookies de access token y refresh token con `HttpOnly`, `Secure`, `SameSite`
- **AND** persiste el refresh token hasheado en `refresh_token` con `revoked = false` y su `expires_at`
- **AND** registra el evento de login en el log de aplicación sin incluir contraseña ni tokens

#### Scenario: Contraseña incorrecta
- **WHEN** un usuario envía `POST /auth/login` con una contraseña que no coincide con el hash
- **THEN** el sistema responde 401 con un mensaje genérico de credenciales inválidas
- **AND** no emite cookies ni crea registros en `refresh_token`

#### Scenario: Email inexistente
- **WHEN** se envía `POST /auth/login` con un email que no existe en `usuario`
- **THEN** el sistema responde 401 con el mismo mensaje genérico que en contraseña incorrecta (sin revelar si el email existe)

#### Scenario: Cuenta desactivada
- **WHEN** un usuario con `activo = false` envía credenciales correctas
- **THEN** el sistema responde 401 y no emite sesión

### Requirement: Emisión de tokens en cookies seguras

El sistema SHALL emitir el access token y el refresh token exclusivamente como cookies `HttpOnly`, `Secure` y `SameSite`, sin devolverlos en el body ni en headers de respuesta. El access token SHALL tener una vigencia de 15 minutos y el refresh token de 7 días, configurables vía entorno (`JWT_ACCESS_EXPIRE_MINUTES`, `JWT_REFRESH_EXPIRE_DAYS`). Los tokens SHALL firmarse con `JWT_SECRET` y `JWT_ALGORITHM`. El refresh token SHALL guardarse hasheado en la base (nunca en texto plano) para permitir su revocación. (RF-01, RNF-11, RNF-12)

#### Scenario: Los tokens nunca viajan en el body
- **WHEN** el login es exitoso
- **THEN** el body de la respuesta contiene solo el perfil del usuario
- **AND** los tokens viajan únicamente en cookies marcadas `HttpOnly`

#### Scenario: El refresh se almacena hasheado
- **WHEN** se emite un refresh token
- **THEN** el valor persistido en la columna `refresh_token.token` es un hash, no el token en claro

### Requirement: Renovación del access token

El sistema SHALL exponer `POST /api/v1/auth/refresh` que toma el refresh token de la cookie, verifica que exista en `refresh_token`, que no esté revocado y que no haya expirado, y SHALL emitir un nuevo access token en cookie. La operación SHALL rotar el refresh token (revocar el anterior y emitir uno nuevo persistido) para limitar el robo de tokens. Si el refresh es inválido, está revocado o vencido, el sistema SHALL responder 401. (RF-01)

#### Scenario: Refresh válido
- **WHEN** se envía `POST /auth/refresh` con un refresh token vigente y no revocado
- **THEN** el sistema responde 200 y setea una nueva cookie de access token
- **AND** rota el refresh token (revoca el anterior y persiste el nuevo)

#### Scenario: Refresh revocado o vencido
- **WHEN** se envía `POST /auth/refresh` con un refresh token revocado o expirado
- **THEN** el sistema responde 401 y no emite un nuevo access token

#### Scenario: Sin cookie de refresh
- **WHEN** se envía `POST /auth/refresh` sin cookie de refresh
- **THEN** el sistema responde 401

### Requirement: Cierre de sesión

El sistema SHALL exponer `POST /api/v1/auth/logout` que revoca el refresh token asociado a la sesión en la tabla `refresh_token` (`revoked = true`), limpia las cookies de access y refresh en la respuesta, y registra el evento de logout en el log de aplicación. La operación SHALL ser idempotente: invocarla sin sesión válida o con un refresh ya revocado limpia cookies y responde con éxito sin error. (RF-04, UC-01)

#### Scenario: Logout con sesión activa
- **WHEN** un usuario autenticado envía `POST /auth/logout`
- **THEN** el sistema marca su refresh token como `revoked = true`
- **AND** limpia las cookies de access y refresh en la respuesta
- **AND** registra el evento de logout sin datos sensibles

#### Scenario: El refresh revocado no sirve para renovar
- **WHEN** después de un logout se intenta `POST /auth/refresh` con el refresh revocado
- **THEN** el sistema responde 401

### Requirement: Backend stateless de sesión

El sistema SHALL mantener el backend stateless respecto de la sesión: ningún estado de sesión vive en la memoria del proceso; la identidad se reconstruye en cada request a partir del access token (cookie) y la revocación se consulta contra la tabla `refresh_token`. (RNF-12)

#### Scenario: La sesión sobrevive a un reinicio del backend
- **WHEN** el proceso del backend se reinicia y el usuario tiene cookies de sesión vigentes
- **THEN** las peticiones autenticadas siguen siendo válidas sin necesidad de re-login
