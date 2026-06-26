## ADDED Requirements

### Requirement: Alta de caso
El sistema SHALL exponer `POST /api/v1/casos` para crear un caso vinculado a **un** cliente y **un** abogado responsable, indicando el `area` (LABORAL o ART) (RF-08, RN-01). El acceso SHALL estar restringido a los roles **ABOGADO** y **SOCIO**. El cuerpo SHALL validarse con Pydantic e incluir `cliente_id`, `abogado_responsable_id` y `area` como obligatorios, y `tipo_reclamo`, `codigo_expediente`, `fecha_inicio`, `observaciones` y `ficha_laboral` como opcionales. En área ART el `tipo_reclamo` (ACCIDENTE o ENFERMEDAD) SHALL ser obligatorio; en LABORAL SHALL ser nulo (RN-11). El caso SHALL nacer en la **etapa inicial del área** resuelta como dato (etapa de esa `area` con menor `orden`), NUNCA por un enum ni un nombre fijo (ADR-0008). La creación SHALL generar la **primera entrada de historial** con `etapa_anterior_id` nulo (RN-05). Ante éxito el sistema SHALL responder `201` con el caso creado (incluyendo `id` y `etapa_actual`).

#### Scenario: Abogado crea un caso Laboral válido
- **WHEN** un usuario ABOGADO o SOCIO hace `POST /casos` con CSRF válido, `cliente_id` y `abogado_responsable_id` existentes y `area = LABORAL`
- **THEN** el sistema crea el caso en la etapa inicial del área Laboral, registra la primera entrada de historial y responde `201` con el caso creado

#### Scenario: Caso ART sin tipo de reclamo
- **WHEN** un usuario hace `POST /casos` con `area = ART` y sin `tipo_reclamo`
- **THEN** el sistema responde `422` y no crea el caso

#### Scenario: Caso con ficha laboral anidada
- **WHEN** un usuario ABOGADO o SOCIO hace `POST /casos` válido incluyendo el objeto `ficha_laboral`
- **THEN** el sistema crea el caso y su ficha laboral 1:1 en la misma operación y responde `201`

#### Scenario: Cliente o abogado inexistente
- **WHEN** un usuario hace `POST /casos` con un `cliente_id` o `abogado_responsable_id` que no existe
- **THEN** el sistema responde `422` (o `404`) y no crea el caso

#### Scenario: Petición sin sesión
- **WHEN** se hace `POST /casos` sin cookie de access token válida
- **THEN** el sistema responde `401`

### Requirement: Registro de la ficha laboral de admisión
El sistema SHALL exponer `PUT /api/v1/casos/{id}/ficha-laboral` para crear o actualizar la ficha de admisión laboral asociada al caso, en relación **1:1** (RF-09). El acceso SHALL estar restringido a los roles **ABOGADO** y **SOCIO**. El cuerpo SHALL validarse con Pydantic. Si el caso no existe el sistema SHALL responder `404`.

#### Scenario: Crear la ficha de un caso sin ficha previa
- **WHEN** un usuario ABOGADO o SOCIO hace `PUT /casos/{id}/ficha-laboral` con CSRF válido sobre un caso existente sin ficha
- **THEN** el sistema crea la ficha laboral 1:1 y responde `200`

#### Scenario: Actualizar la ficha existente
- **WHEN** un usuario ABOGADO o SOCIO hace `PUT /casos/{id}/ficha-laboral` sobre un caso que ya tiene ficha
- **THEN** el sistema actualiza los campos de la ficha y responde `200`

#### Scenario: Caso inexistente
- **WHEN** un usuario hace `PUT /casos/{id}/ficha-laboral` sobre un `id` que no existe
- **THEN** el sistema responde `404`

### Requirement: Avance de etapa validado contra transiciones del área
El sistema SHALL exponer `POST /api/v1/casos/{id}/avanzar` para avanzar la etapa del caso de forma **manual** (RF-10). El acceso SHALL estar restringido a los roles **ABOGADO** y **SOCIO**. El sistema SHALL aceptar el avance solo si existe una **transición válida** en `transicion_etapa` desde la etapa actual del caso hacia la etapa destino indicada (RN-04); como las transiciones son intra-área, el avance NUNCA cruza de área (RN-11). Un avance válido SHALL actualizar la etapa actual del caso y SHALL registrar una entrada en el historial del caso (RN-05), ambas en la misma transacción. El sistema NO SHALL hardcodear etapas ni transiciones (ADR-0008).

#### Scenario: Avance por una transición válida
- **WHEN** un usuario ABOGADO o SOCIO hace `POST /casos/{id}/avanzar` con CSRF válido hacia una etapa destino que tiene transición permitida desde la etapa actual
- **THEN** el sistema actualiza la etapa actual, registra la entrada de historial (evento de avance) y responde `200` con el caso actualizado

#### Scenario: Avance por una transición inexistente
- **WHEN** un usuario hace `POST /casos/{id}/avanzar` hacia una etapa que no tiene transición permitida desde la etapa actual
- **THEN** el sistema responde `409`, no cambia la etapa y no registra historial

#### Scenario: Avance sobre caso inexistente
- **WHEN** un usuario hace `POST /casos/{id}/avanzar` sobre un `id` de caso que no existe
- **THEN** el sistema responde `404`

### Requirement: Retroceso de etapa con confirmación explícita
El sistema SHALL exponer `POST /api/v1/casos/{id}/retroceder` para retroceder la etapa del caso (RF-11). El acceso SHALL estar restringido a los roles **ABOGADO** y **SOCIO**. La etapa destino SHALL pertenecer a la **misma área** del caso (RN-11). Si el caso está en una etapa **terminal** (`es_terminal`), el retroceso SHALL requerir confirmación explícita (`confirmar = true`); sin confirmación el sistema SHALL rechazar la operación (RN-09). Un retroceso válido SHALL actualizar la etapa actual y SHALL registrar una entrada en el historial (RN-05), en la misma transacción.

#### Scenario: Retroceso confirmado desde etapa terminal
- **WHEN** un usuario ABOGADO o SOCIO hace `POST /casos/{id}/retroceder` con CSRF válido, `confirmar = true`, sobre un caso en etapa terminal y hacia una etapa de su misma área
- **THEN** el sistema actualiza la etapa actual, registra la entrada de historial (evento de retroceso) y responde `200`

#### Scenario: Retroceso desde etapa terminal sin confirmación
- **WHEN** un usuario hace `POST /casos/{id}/retroceder` sobre un caso en etapa terminal sin `confirmar = true`
- **THEN** el sistema responde `409` (o `422`), no cambia la etapa y no registra historial

#### Scenario: Retroceso hacia otra área
- **WHEN** un usuario hace `POST /casos/{id}/retroceder` hacia una etapa que no pertenece al área del caso
- **THEN** el sistema responde `409` y no cambia la etapa

### Requirement: Consulta del historial inmutable del caso
El sistema SHALL exponer `GET /api/v1/casos/{id}/historial` para consultar el historial **cronológico** de movimientos del caso (RF-12). La lectura SHALL estar disponible para **todo usuario autenticado** (RN-08). El historial SHALL ser **inmutable**: el sistema NO SHALL ofrecer endpoints ni lógica para editar o eliminar entradas de historial (RN-06); solo lectura e inserción interna ante cambios de etapa. Cada entrada SHALL incluir `etapa_anterior`, `etapa_nueva`, `evento`, `autor` y `ocurrido_en`.

#### Scenario: Consultar el historial de un caso
- **WHEN** un usuario autenticado hace `GET /casos/{id}/historial` sobre un caso existente
- **THEN** el sistema responde `200` con las entradas ordenadas cronológicamente, incluyendo la entrada de creación

#### Scenario: No existe forma de modificar el historial
- **WHEN** se inspecciona la API de casos
- **THEN** no existe ningún endpoint que edite o elimine entradas de `historial_caso`

#### Scenario: Historial de caso inexistente
- **WHEN** un usuario autenticado hace `GET /casos/{id}/historial` sobre un `id` que no existe
- **THEN** el sistema responde `404`

### Requirement: Detalle de caso con transiciones válidas
El sistema SHALL exponer `GET /api/v1/casos/{id}` para consultar el detalle de un caso (cliente, área, etapa actual, ficha, fechas y observaciones). La lectura SHALL estar disponible para **todo usuario autenticado** (RN-08). La respuesta SHALL incluir las **transiciones válidas** desde la etapa actual (derivadas de `transicion_etapa`) para que el frontend renderice el avance sin hardcodear etapas (ADR-0008).

#### Scenario: Usuario autenticado consulta el detalle de un caso
- **WHEN** un usuario autenticado hace `GET /casos/{id}` sobre un caso existente
- **THEN** el sistema responde `200` con el detalle del caso y la lista de etapas destino válidas desde la etapa actual

#### Scenario: Caso inexistente
- **WHEN** un usuario autenticado hace `GET /casos/{id}` sobre un `id` que no existe
- **THEN** el sistema responde `404`

### Requirement: Listado y filtrado de casos
El sistema SHALL exponer `GET /api/v1/casos?area=&etapa=&abogado_id=&cliente_id=&page=` para listar casos de forma paginada y filtrarlos por **área, etapa, abogado o cliente** (RF-13). La lectura SHALL estar disponible para **todo usuario autenticado** (RN-08). Los filtros SHALL ser opcionales y combinables, y SHALL construirse con SQL parametrizado.

#### Scenario: Listar sin filtros
- **WHEN** un usuario autenticado hace `GET /casos` sin filtros
- **THEN** el sistema responde `200` con la página de casos

#### Scenario: Filtrar por área
- **WHEN** un usuario autenticado hace `GET /casos?area=ART`
- **THEN** el sistema responde `200` solo con los casos del área ART

#### Scenario: Filtrar por abogado y cliente combinados
- **WHEN** un usuario autenticado hace `GET /casos?abogado_id=<a>&cliente_id=<c>`
- **THEN** el sistema responde `200` con los casos que cumplen ambos filtros

#### Scenario: Petición sin sesión
- **WHEN** se hace `GET /casos` sin cookie de access token válida
- **THEN** el sistema responde `401`

### Requirement: Protección CSRF y rate limiting en mutaciones de casos
Todas las mutaciones de casos (`POST /casos`, `PUT /casos/{id}/ficha-laboral`, `POST /casos/{id}/avanzar`, `POST /casos/{id}/retroceder`) SHALL estar protegidas por el CSRF middleware double-submit existente (el header `X-CSRF-Token` debe coincidir con la cookie `csrf_token`) y SHALL respetar el rate limiting de la API (~100/min). Una mutación sin token CSRF válido SHALL responder `403` antes de ejecutar lógica de negocio. Los `GET` están exentos de CSRF por ser métodos seguros.

#### Scenario: Mutación sin CSRF
- **WHEN** un usuario hace `POST /casos` sin el header `X-CSRF-Token` o con un valor que no coincide con la cookie
- **THEN** el sistema responde `403` sin crear el caso

### Requirement: Acceso a la gestión de casos en el frontend
El frontend SHALL ofrecer pantallas de gestión de casos accesibles para **todo usuario autenticado**. Las pantallas SHALL permitir listar y filtrar casos, crear un caso con su ficha de admisión, ver el detalle con un stepper de etapas (avance y retroceso con confirmación) y consultar el historial, consumiendo los endpoints `/casos` vía el cliente HTTP compartido (con `credentials: 'include'` y reenvío de `X-CSRF-Token` en las mutaciones). El stepper SHALL renderizar las transiciones a partir de las **transiciones válidas** que devuelve el backend, sin hardcodear etapas (ADR-0008). Los errores de negocio (`409` transición inválida / retroceso sin confirmar, `404`, `422`) SHALL mostrarse con mensajes claros en español.

#### Scenario: Usuario autenticado gestiona casos
- **WHEN** un usuario autenticado navega a la gestión de casos
- **THEN** ve el listado con filtros y las acciones de alta, detalle (con stepper) e historial

#### Scenario: Avance bloqueado en el frontend
- **WHEN** el backend rechaza un avance por transición inválida (`409`)
- **THEN** el frontend muestra un mensaje claro y no altera la etapa mostrada

#### Scenario: Retroceso desde etapa terminal pide confirmación
- **WHEN** el usuario intenta retroceder un caso en etapa terminal
- **THEN** el frontend solicita confirmación explícita antes de enviar la operación (RN-09)
