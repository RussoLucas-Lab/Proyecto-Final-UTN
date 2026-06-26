## ADDED Requirements

### Requirement: Identificación del usuario autenticado

El sistema SHALL proveer una dependencia reutilizable (`get_current_user`) que, en cada request a un recurso protegido, valida el access token de la cookie, verifica su firma y vigencia, y resuelve el usuario correspondiente desde la tabla `usuario`. Si el token falta, es inválido o está vencido, la dependencia SHALL responder 401. Si el usuario asociado ya no está activo (`activo = false`), SHALL responder 401. Ningún recurso protegido SHALL ser accesible sin una sesión válida. (RF-02, RNF-01)

#### Scenario: Acceso con sesión válida
- **WHEN** una petición a un endpoint protegido llega con un access token vigente de un usuario activo
- **THEN** la dependencia resuelve el usuario y permite continuar

#### Scenario: Acceso sin sesión
- **WHEN** una petición a un endpoint protegido llega sin cookie de access token
- **THEN** el sistema responde 401 y no ejecuta la lógica del endpoint

#### Scenario: Token vencido
- **WHEN** una petición protegida llega con un access token expirado
- **THEN** el sistema responde 401 (el cliente debe renovar vía `/auth/refresh`)

#### Scenario: Cuenta desactivada tras emitir la sesión
- **WHEN** un usuario fue desactivado (`activo = false`) pero conserva un access token vigente
- **THEN** la siguiente petición protegida responde 401

### Requirement: Control de acceso por rol (RBAC)

El sistema SHALL distinguir los roles `SOCIO` y `ABOGADO` y proveer dependencias reutilizables para restringir endpoints por rol (`require_socio`, `require_roles(...)`). Las operaciones de gestión de usuarios SHALL quedar restringidas exclusivamente al rol `SOCIO`. Cuando un usuario autenticado intenta una operación no permitida para su rol, el sistema SHALL responder 403. La lectura de los casos del estudio SHALL estar disponible para todo usuario autenticado, sin restricción por titularidad. (RF-02, RN-07, RN-08, RNF-01)

#### Scenario: SOCIO accede a operación restringida a SOCIO
- **WHEN** un usuario con rol `SOCIO` invoca un endpoint protegido por `require_socio`
- **THEN** el sistema permite la operación

#### Scenario: ABOGADO bloqueado en operación de SOCIO
- **WHEN** un usuario con rol `ABOGADO` invoca un endpoint protegido por `require_socio`
- **THEN** el sistema responde 403 y registra el acceso denegado en el log de seguridad

#### Scenario: Lectura amplia de casos
- **WHEN** cualquier usuario autenticado (SOCIO o ABOGADO) consulta los casos del estudio
- **THEN** el sistema permite la lectura sin filtrar por titularidad del caso

### Requirement: Dependencia base de sesión de base de datos

El sistema SHALL proveer una dependencia transversal (`get_db`) que abre y cierra una sesión de SQLAlchemy por request, reutilizable por todas las features, evitando que cada feature gestione su propia conexión. (ADR-0009, RNF-12)

#### Scenario: Sesión por request
- **WHEN** un endpoint declara la dependencia `get_db`
- **THEN** recibe una sesión activa que se cierra automáticamente al finalizar la request
