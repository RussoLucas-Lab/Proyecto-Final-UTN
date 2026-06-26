## ADDED Requirements

### Requirement: Alta de cliente (admisión)
El sistema SHALL exponer `POST /api/v1/clientes` para registrar un cliente nuevo durante la admisión (RF-05, UC-02). El acceso SHALL estar restringido a los roles **ABOGADO** y **SOCIO**. El cuerpo SHALL validarse con Pydantic e incluir `nombre` y `dni` como obligatorios, y `cuil`, `telefono`, `email`, `domicilio_real`, `domicilio_real_cp`, `domicilio_real_localidad`, `domicilio_real_provincia` y `domicilio_coincide_dni` como opcionales. El `dni` SHALL ser único en el estudio (RN-03). Ante éxito el sistema SHALL responder `201` con el cliente creado (incluyendo su `id` y `creado_en`).

#### Scenario: Abogado crea un cliente válido
- **WHEN** un usuario ABOGADO o SOCIO hace `POST /clientes` con CSRF válido, `nombre`, `dni` y un DNI no usado
- **THEN** el sistema crea el cliente y responde `201` con el cliente creado (incluido su `id`)

#### Scenario: DNI duplicado
- **WHEN** un usuario hace `POST /clientes` con un `dni` que ya existe en el estudio
- **THEN** el sistema responde `409` y no crea el cliente (RN-03)

#### Scenario: Payload inválido
- **WHEN** un usuario hace `POST /clientes` sin `nombre` o sin `dni`, o con un `email` mal formado
- **THEN** el sistema responde `422` y no crea el cliente

#### Scenario: Petición sin sesión
- **WHEN** se hace `POST /clientes` sin cookie de access token válida
- **THEN** el sistema responde `401`

### Requirement: Consulta de cliente
El sistema SHALL exponer `GET /api/v1/clientes/{id}` para consultar los datos de un cliente (RF-06). La lectura SHALL estar disponible para **todo usuario autenticado** (RN-08); no requiere un rol específico. La respuesta SHALL incluir `id`, `nombre`, `dni`, `cuil`, `telefono`, `email`, `domicilio_real` (+ `_cp`/`_localidad`/`_provincia`), `domicilio_coincide_dni` y `creado_en`.

#### Scenario: Usuario autenticado consulta un cliente existente
- **WHEN** un usuario autenticado hace `GET /clientes/{id}` sobre un cliente existente
- **THEN** el sistema responde `200` con los datos del cliente

#### Scenario: Cliente inexistente
- **WHEN** un usuario autenticado hace `GET /clientes/{id}` sobre un `id` que no existe
- **THEN** el sistema responde `404`

#### Scenario: Petición sin sesión
- **WHEN** se hace `GET /clientes/{id}` sin cookie de access token válida
- **THEN** el sistema responde `401`

### Requirement: Edición de cliente
El sistema SHALL exponer `PUT /api/v1/clientes/{id}` para editar los datos de un cliente existente (RF-06). El acceso SHALL estar restringido a los roles **ABOGADO** y **SOCIO**. El cuerpo SHALL validarse con Pydantic con los mismos campos que el alta. Si la edición cambia el `dni` a uno que ya pertenece a **otro** cliente, el sistema SHALL responder `409` (RN-03).

#### Scenario: Abogado edita un cliente existente
- **WHEN** un usuario ABOGADO o SOCIO hace `PUT /clientes/{id}` con CSRF válido sobre un cliente existente con datos válidos
- **THEN** el sistema actualiza los campos y responde `200` con el cliente actualizado

#### Scenario: Cliente inexistente
- **WHEN** un usuario hace `PUT /clientes/{id}` sobre un `id` que no existe
- **THEN** el sistema responde `404`

#### Scenario: Edición a un DNI ya usado por otro cliente
- **WHEN** un usuario hace `PUT /clientes/{id}` cambiando el `dni` a uno que ya pertenece a otro cliente
- **THEN** el sistema responde `409` y no aplica el cambio

### Requirement: Listado y búsqueda de clientes
El sistema SHALL exponer `GET /api/v1/clientes?search=&page=` para listar clientes de forma paginada y buscar por **nombre o DNI** (RF-07). La lectura SHALL estar disponible para **todo usuario autenticado** (RN-08). Cuando se provee `search`, el sistema SHALL devolver los clientes cuyo `nombre` coincida de forma parcial e insensible a mayúsculas, o cuyo `dni` coincida. Sin `search`, SHALL devolver la lista paginada completa.

#### Scenario: Listar sin filtro
- **WHEN** un usuario autenticado hace `GET /clientes` sin `search`
- **THEN** el sistema responde `200` con la página de clientes

#### Scenario: Buscar por nombre
- **WHEN** un usuario autenticado hace `GET /clientes?search=<parte-del-nombre>`
- **THEN** el sistema responde `200` con los clientes cuyo nombre coincide parcialmente (sin distinguir mayúsculas)

#### Scenario: Buscar por DNI
- **WHEN** un usuario autenticado hace `GET /clientes?search=<dni>`
- **THEN** el sistema responde `200` con el/los cliente(s) cuyo DNI coincide

#### Scenario: Petición sin sesión
- **WHEN** se hace `GET /clientes` sin cookie de access token válida
- **THEN** el sistema responde `401`

### Requirement: Protección CSRF y rate limiting en mutaciones de clientes
Todas las mutaciones de clientes (`POST`, `PUT`) SHALL estar protegidas por el CSRF middleware double-submit existente (el header `X-CSRF-Token` debe coincidir con la cookie `csrf_token`) y SHALL respetar el rate limiting de la API (~100/min). Una mutación sin token CSRF válido SHALL responder `403` antes de ejecutar lógica de negocio. Los `GET` están exentos de CSRF por ser métodos seguros.

#### Scenario: Mutación sin CSRF
- **WHEN** un usuario hace `POST /clientes` sin el header `X-CSRF-Token` o con un valor que no coincide con la cookie
- **THEN** el sistema responde `403` sin crear el cliente

### Requirement: Acceso a la gestión de clientes en el frontend
El frontend SHALL ofrecer una pantalla de gestión de clientes accesible para **todo usuario autenticado**. La pantalla SHALL permitir listar, buscar (por nombre o DNI), crear y editar clientes consumiendo los endpoints `/clientes` vía el cliente HTTP compartido (con `credentials: 'include'` y reenvío de `X-CSRF-Token` en las mutaciones). Los errores de negocio (`409` DNI duplicado, `404`, `422`) SHALL mostrarse con mensajes claros en español.

#### Scenario: Usuario autenticado gestiona clientes
- **WHEN** un usuario autenticado navega a la ruta de gestión de clientes
- **THEN** ve el listado con buscador y las acciones de alta y edición

#### Scenario: Alta con DNI duplicado en el frontend
- **WHEN** el usuario intenta crear un cliente con un DNI que ya existe
- **THEN** el frontend muestra un mensaje de error claro (DNI ya registrado) y no agrega un cliente duplicado
