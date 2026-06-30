## ADDED Requirements

### Requirement: Registrar vencimiento en un caso
El sistema SHALL permitir a un usuario autenticado con rol ABOGADO o SOCIO crear un vencimiento asociado a un caso existente, con descripción (≤255 chars) y fecha. El campo `completado` arranca en `false`. El campo `creado_por` se asigna automáticamente al usuario autenticado.

#### Scenario: Alta exitosa
- **WHEN** un ABOGADO autenticado envía `POST /casos/1/vencimientos` con `{ "descripcion": "Presentar demanda", "fecha": "2026-07-15" }`
- **THEN** responde 201 con el vencimiento creado: `{ "id": 1, "caso_id": 1, "descripcion": "Presentar demanda", "fecha": "2026-07-15", "completado": false, "creado_por": 2, "creado_en": "<timestamp>" }`

#### Scenario: Caso inexistente
- **WHEN** se envía `caso_id` que no existe en la base de datos
- **THEN** responde 404 con detalle "Caso no encontrado"

#### Scenario: Sin sesión
- **WHEN** se llama sin cookie de acceso válida
- **THEN** responde 401

#### Scenario: Rol insuficiente
- **WHEN** un usuario sin rol ABOGADO o SOCIO intenta crear un vencimiento
- **THEN** responde 403

#### Scenario: Descripción vacía
- **WHEN** se envía `descripcion: ""`
- **THEN** responde 422

### Requirement: Listar vencimientos del caso
El sistema SHALL permitir a cualquier usuario autenticado listar los vencimientos de un caso específico, ordenados por fecha ascendente.

#### Scenario: Lista con vencimientos
- **WHEN** un usuario autenticado envía `GET /casos/1/vencimientos`
- **THEN** responde 200 con lista de vencimientos del caso ordenados por `fecha ASC`

#### Scenario: Lista vacía
- **WHEN** el caso existe pero no tiene vencimientos
- **THEN** responde 200 con lista vacía `[]`

#### Scenario: Caso inexistente
- **WHEN** el `caso_id` no existe
- **THEN** responde 404

### Requirement: Vista calendario compartida del estudio
El sistema SHALL proveer `GET /vencimientos?desde=&hasta=` que retorne todos los vencimientos del estudio en un rango de fechas (inclusive), visible para cualquier usuario autenticado. Los parámetros `desde` y `hasta` son obligatorios y en formato `YYYY-MM-DD`.

#### Scenario: Consulta con rango válido
- **WHEN** un usuario autenticado envía `GET /vencimientos?desde=2026-07-01&hasta=2026-07-31`
- **THEN** responde 200 con todos los vencimientos cuya `fecha` esté entre `2026-07-01` y `2026-07-31` (inclusive), de todo el estudio

#### Scenario: Sin parámetros obligatorios
- **WHEN** se omite `desde` o `hasta`
- **THEN** responde 422

#### Scenario: Sin sesión
- **WHEN** se llama sin cookie de acceso válida
- **THEN** responde 401

### Requirement: Marcar vencimiento como completado
El sistema SHALL permitir a un usuario con rol ABOGADO o SOCIO marcar un vencimiento como completado enviando `PATCH /vencimientos/{id}` con `{ "completado": true }`. La operación es idempotente (ya completado → 200 sin error).

#### Scenario: Marcado exitoso
- **WHEN** un ABOGADO autenticado envía `PATCH /vencimientos/1` con `{ "completado": true }`
- **THEN** responde 200 con el vencimiento actualizado con `completado: true`

#### Scenario: Vencimiento inexistente
- **WHEN** el `id` no existe en la base de datos
- **THEN** responde 404

#### Scenario: Sin sesión
- **WHEN** se llama sin cookie de acceso válida
- **THEN** responde 401
