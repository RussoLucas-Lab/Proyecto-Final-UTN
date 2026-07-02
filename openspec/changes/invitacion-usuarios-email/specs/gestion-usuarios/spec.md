## MODIFIED Requirements

### Requirement: Alta de usuario (solo SOCIO)
El sistema SHALL exponer `POST /api/v1/usuarios` restringido al rol **SOCIO** (RF-03, RN-07). El cuerpo SHALL validarse con Pydantic e incluir `nombre`, `email`, `rol`, `area`, `matricula` y una contraseña inicial. El email SHALL ser único; la contraseña SHALL almacenarse hasheada con bcrypt (reutilizando `hash_password`) y NUNCA en texto plano. El usuario se crea con `activo = true`. El modelo de usuario SHALL incorporar además un **estado de cuenta** con valores **INVITED** y **ACTIVE**, ortogonal a la baja lógica `activo` (INVITED/ACTIVE describe el ciclo de credenciales; `activo` describe si la cuenta está habilitada). El alta directa por este endpoint SHALL crear el usuario en estado **ACTIVE** (ya tiene contraseña). El alta por invitación (ver capability `invitacion-usuarios`) crea el usuario en estado **INVITED**, sin contraseña utilizable, hasta que el invitado la fije al activar. Si el `rol` es `SOCIO`, `area` SHALL poder ser nula (los socios son transversales); si el `rol` es `ABOGADO`, `area` SHALL ser obligatoria.

#### Scenario: SOCIO crea un usuario válido
- **WHEN** un SOCIO hace `POST /usuarios` con CSRF válido y datos completos y un email no usado
- **THEN** el sistema crea el usuario con `activo = true` y estado de cuenta **ACTIVE**, hashea la contraseña y responde `201` con el usuario creado (sin `password_hash`)

#### Scenario: Email duplicado
- **WHEN** un SOCIO hace `POST /usuarios` con un email que ya existe
- **THEN** el sistema responde `409` y no crea el usuario

#### Scenario: ABOGADO intenta crear un usuario
- **WHEN** un usuario con rol ABOGADO hace `POST /usuarios`
- **THEN** el sistema responde `403` y no crea el usuario

#### Scenario: Payload inválido
- **WHEN** un SOCIO hace `POST /usuarios` con email mal formado o campos requeridos faltantes
- **THEN** el sistema responde `422`

#### Scenario: Usuarios existentes tras la migración
- **WHEN** se aplica la migración que introduce el estado de cuenta
- **THEN** todos los usuarios preexistentes quedan en estado **ACTIVE** (retrocompatibilidad)
