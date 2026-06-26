## ADDED Requirements

### Requirement: Listado de usuarios
El sistema SHALL exponer `GET /api/v1/usuarios` para listar los usuarios del estudio. La lectura está disponible para **todo usuario autenticado** (RN-08); no requiere rol SOCIO. La respuesta SHALL incluir, por usuario: `id`, `nombre`, `email`, `rol`, `area`, `matricula`, `activo` y `creado_en`, y NUNCA SHALL incluir `password_hash` ni ningún dato sensible de credenciales.

#### Scenario: Usuario autenticado lista usuarios
- **WHEN** un usuario autenticado (SOCIO o ABOGADO) hace `GET /usuarios` con su cookie de sesión válida
- **THEN** el sistema responde `200` con el arreglo de usuarios sin exponer `password_hash`

#### Scenario: Petición sin sesión
- **WHEN** se hace `GET /usuarios` sin cookie de access token válida
- **THEN** el sistema responde `401`

### Requirement: Alta de usuario (solo SOCIO)
El sistema SHALL exponer `POST /api/v1/usuarios` restringido al rol **SOCIO** (RF-03, RN-07). El cuerpo SHALL validarse con Pydantic e incluir `nombre`, `email`, `rol`, `area`, `matricula` y una contraseña inicial. El email SHALL ser único; la contraseña SHALL almacenarse hasheada con bcrypt (reutilizando `hash_password`) y NUNCA en texto plano. El usuario se crea con `activo = true`. Si el `rol` es `SOCIO`, `area` SHALL poder ser nula (los socios son transversales); si el `rol` es `ABOGADO`, `area` SHALL ser obligatoria.

#### Scenario: SOCIO crea un usuario válido
- **WHEN** un SOCIO hace `POST /usuarios` con CSRF válido y datos completos y un email no usado
- **THEN** el sistema crea el usuario con `activo = true`, hashea la contraseña y responde `201` con el usuario creado (sin `password_hash`)

#### Scenario: Email duplicado
- **WHEN** un SOCIO hace `POST /usuarios` con un email que ya existe
- **THEN** el sistema responde `409` y no crea el usuario

#### Scenario: ABOGADO intenta crear un usuario
- **WHEN** un usuario con rol ABOGADO hace `POST /usuarios`
- **THEN** el sistema responde `403` y no crea el usuario

#### Scenario: Payload inválido
- **WHEN** un SOCIO hace `POST /usuarios` con email mal formado o campos requeridos faltantes
- **THEN** el sistema responde `422`

### Requirement: Edición de usuario (solo SOCIO)
El sistema SHALL exponer `PUT /api/v1/usuarios/{id}` restringido al rol **SOCIO** para editar `nombre`, `rol`, `area` y `matricula` de un usuario existente. La validación de coherencia rol/área (ABOGADO requiere área; SOCIO permite área nula) SHALL aplicarse igual que en el alta. La edición NO SHALL permitir cambiar la contraseña por este endpoint ni exponer `password_hash`.

#### Scenario: SOCIO edita un usuario existente
- **WHEN** un SOCIO hace `PUT /usuarios/{id}` con CSRF válido sobre un usuario existente con datos válidos
- **THEN** el sistema actualiza los campos y responde `200` con el usuario actualizado

#### Scenario: Usuario inexistente
- **WHEN** un SOCIO hace `PUT /usuarios/{id}` sobre un `id` que no existe
- **THEN** el sistema responde `404`

#### Scenario: ABOGADO intenta editar
- **WHEN** un ABOGADO hace `PUT /usuarios/{id}`
- **THEN** el sistema responde `403`

### Requirement: Activación y baja lógica (solo SOCIO)
El sistema SHALL exponer `PATCH /api/v1/usuarios/{id}` restringido al rol **SOCIO** para activar o desactivar un usuario mediante `{ "activo": true|false }` (baja lógica, RF-03, RN-07). La operación NUNCA SHALL eliminar físicamente el registro. Un SOCIO NO SHALL poder desactivarse a sí mismo (para no dejar al estudio sin administradores).

#### Scenario: SOCIO desactiva otro usuario
- **WHEN** un SOCIO hace `PATCH /usuarios/{id}` con `{ "activo": false }` sobre otro usuario
- **THEN** el sistema marca `activo = false`, conserva el registro y responde `200`

#### Scenario: SOCIO reactiva un usuario
- **WHEN** un SOCIO hace `PATCH /usuarios/{id}` con `{ "activo": true }` sobre un usuario inactivo
- **THEN** el sistema marca `activo = true` y responde `200`

#### Scenario: SOCIO intenta autodesactivarse
- **WHEN** un SOCIO hace `PATCH /usuarios/{id}` con `{ "activo": false }` sobre su propio `id`
- **THEN** el sistema responde `409` (o `400`) y no modifica su estado

#### Scenario: Usuario inexistente
- **WHEN** un SOCIO hace `PATCH /usuarios/{id}` sobre un `id` que no existe
- **THEN** el sistema responde `404`

### Requirement: Protección CSRF y rate limiting en mutaciones
Todas las mutaciones de usuarios (`POST`, `PUT`, `PATCH`) SHALL estar protegidas por el CSRF middleware double-submit existente (header `X-CSRF-Token` debe coincidir con la cookie `csrf_token`) y SHALL respetar el rate limiting de la API (~100/min). Una mutación sin token CSRF válido SHALL responder `403` antes de ejecutar lógica de negocio.

#### Scenario: Mutación sin CSRF
- **WHEN** un SOCIO hace `POST /usuarios` sin el header `X-CSRF-Token` o con un valor que no coincide con la cookie
- **THEN** el sistema responde `403` sin crear el usuario

### Requirement: Acceso a la gestión de usuarios en el frontend
El frontend SHALL ofrecer una pantalla de gestión de usuarios accesible **solo para el rol SOCIO**. Los usuarios con rol ABOGADO NO SHALL ver la ruta ni el acceso de navegación a esta pantalla. La pantalla SHALL permitir listar, crear, editar y activar/desactivar usuarios consumiendo los endpoints `/usuarios` vía el cliente HTTP compartido (con `credentials: 'include'` y reenvío de `X-CSRF-Token`).

#### Scenario: SOCIO accede a gestión de usuarios
- **WHEN** un SOCIO navega a la ruta de gestión de usuarios
- **THEN** ve el listado y las acciones de alta, edición y activación/desactivación

#### Scenario: ABOGADO no ve la gestión de usuarios
- **WHEN** un ABOGADO autenticado intenta acceder a la ruta de gestión de usuarios
- **THEN** el frontend no muestra la pantalla (redirige o bloquea el acceso)
