### Requirement: Prellenado del formulario oficial desde datos del caso

El sistema SHALL prellenar el formulario PDF oficial (Ley 23.789) con datos del caso Laboral, cliente y ficha laboral obtenidos de `GET /casos/{id}`. Los campos de texto del PDF SHALL llenarse usando los nombres exactos del formulario oficial (tabla en `08-features/generador-telegramas.md`). El radio group `Opciones de comunicación` SHALL seleccionarse en `Opción3` (Otro) por defecto. El abogado SHALL poder editar cualquier campo antes de generar el PDF. La generación SHALL ejecutarse íntegramente en el navegador con `pdf-lib`, sin llamadas adicionales al backend.

#### Scenario: Caso Laboral con ficha laboral completa
- **WHEN** el abogado abre el generador desde un caso Laboral con `ficha_laboral` y `cliente` completos
- **THEN** todos los campos del formulario aparecen prellenados con los datos del caso

#### Scenario: Datos parciales o ficha laboral incompleta
- **WHEN** faltan datos en `ficha_laboral` o `cliente`
- **THEN** los campos correspondientes aparecen vacíos y el abogado puede completarlos manualmente

#### Scenario: Campo del PDF no encontrado en la versión del formulario
- **WHEN** `pdf-lib` no encuentra un campo por su nombre exacto
- **THEN** la generación continúa sin ese campo y se registra el error en consola (no bloquea)

### Requirement: Restricción a casos Laborales

El generador de telegramas SHALL estar disponible únicamente para casos del área **Laboral** (RN-15). La opción de generar telegrama no SHALL mostrarse ni estar accesible desde casos del área ART.

#### Scenario: Caso Laboral
- **WHEN** el abogado accede al caso y el área es Laboral
- **THEN** la opción "Generar telegrama" está disponible

#### Scenario: Caso ART
- **WHEN** el abogado accede al caso y el área es ART
- **THEN** la opción "Generar telegrama" no está presente en la interfaz

### Requirement: Selección de número de telegrama (1, 2 o 3)

El abogado SHALL indicar el número del telegrama (1, 2 o 3) antes de generar (RN-16). El sistema SHALL mostrar qué números ya tienen un telegrama registrado para ese caso, para orientar la elección.

#### Scenario: Selección de número disponible
- **WHEN** el abogado elige un número (1, 2 o 3) que no tiene telegrama registrado
- **THEN** el formulario se habilita con ese número preseleccionado

#### Scenario: Número ya registrado
- **WHEN** el abogado elige un número que ya tiene un telegrama registrado para ese caso
- **THEN** el sistema advierte que ese número ya fue generado (no bloquea — puede regenerar)

### Requirement: Validación de extensión del texto del reclamo

El sistema SHALL mostrar una advertencia (no bloqueante) cuando el texto del reclamo (`Campo de texto`) tiene menos de 30 palabras, siguiendo la validación del prototipo (el formato oficial está pensado para mensajes de más de 30 palabras).

#### Scenario: Texto con menos de 30 palabras
- **WHEN** el abogado escribe un texto con menos de 30 palabras en el campo de reclamo
- **THEN** el sistema muestra un aviso informativo; el botón de generar PDF sigue habilitado

#### Scenario: Texto con 30 o más palabras
- **WHEN** el texto del reclamo tiene 30 o más palabras
- **THEN** no se muestra ninguna advertencia

### Requirement: Generación y descarga del PDF

El sistema SHALL generar el PDF rellenable oficial en el navegador con `pdf-lib` y permitir su descarga (RN-17). El PDF SHALL soportar caracteres con tildes y ñ. La descarga SHALL ocurrir siempre, independientemente de si el abogado decide guardar el PDF como documento del caso.

#### Scenario: Generación exitosa
- **WHEN** el abogado confirma los datos y presiona "Generar PDF"
- **THEN** el sistema genera el PDF con todos los campos completados y lo descarga en el navegador

#### Scenario: Soporte de tildes
- **WHEN** los datos del caso contienen caracteres con tildes o ñ
- **THEN** el PDF generado muestra esos caracteres correctamente

### Requirement: Guardar PDF como documento del caso y registrar telegrama

Opcionalmente, el abogado SHALL poder guardar el PDF generado como `documento` del caso usando el flujo de subida a R2 ya implementado (`POST /casos/{id}/documentos`). Al guardar, el sistema SHALL crear o actualizar el registro de `telegrama` con `número`, `tipo_comunicacion` y `resultado=PENDIENTE` vía `POST /casos/{id}/telegramas` (RN-18). El sistema SHALL rechazar un segundo telegrama con el mismo número para el mismo caso (unicidad `caso_id + numero`, RN-16).

#### Scenario: Guardar PDF y registrar telegrama
- **WHEN** el abogado presiona "Guardar como documento" tras generar el PDF
- **THEN** el PDF se sube a R2 como documento del caso y se crea el registro de telegrama con `resultado=PENDIENTE`

#### Scenario: Número duplicado en el backend
- **WHEN** ya existe un telegrama con el mismo número para ese caso y se intenta crear otro
- **THEN** el sistema responde 409 y no crea un duplicado

#### Scenario: Guardar falla, descarga ya realizada
- **WHEN** la subida a R2 o el registro del telegrama falla
- **THEN** el PDF ya descargado no se pierde; el sistema muestra un error y permite reintentar

### Requirement: Actualización del resultado de entrega del telegrama

El sistema SHALL exponer `PATCH /telegramas/{id}` para actualizar el resultado de entrega de un telegrama existente (`PENDIENTE` → `ENTREGADO` / `RECHAZADO` / `SIN_EFECTO`). El endpoint SHALL requerir autenticación con rol ABOGADO o SOCIO y protección CSRF.

#### Scenario: Actualizar resultado a ENTREGADO
- **WHEN** un abogado hace `PATCH /telegramas/{id}` con `{ "resultado": "ENTREGADO" }`
- **THEN** el sistema actualiza el campo `resultado` del telegrama y responde 200

#### Scenario: Telegrama inexistente
- **WHEN** se hace `PATCH /telegramas/{id}` para un `id` que no existe
- **THEN** el sistema responde 404

#### Scenario: Sin autenticación o CSRF inválido
- **WHEN** se llama sin cookie JWT válida o sin token CSRF
- **THEN** el sistema responde 401 o 403 respectivamente
