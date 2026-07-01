### Requirement: Listado de borradores por estado para revisión

El sistema SHALL exponer `GET /comunicaciones` con un parámetro de consulta opcional `estado` (validado contra `EstadoComunicacion`), autenticado por cookie JWT (`get_current_user`), que devuelva los borradores de comunicación filtrados por estado. Todo usuario autenticado SHALL poder leer (lectura amplia, RN-08). Por cada borrador el sistema SHALL devolver los datos que la revisión necesita —`id`, `caso_id`, nombre del `cliente`, `area`, nombre de la `etapa` actual, `preview` del contenido, `estado` y `generado_en`— resolviendo `comunicacion → caso → cliente/etapa`, sin exponer DNI/CUIL ni montos (ADR-0004). El endpoint SHALL estar sujeto a rate limiting.

#### Scenario: Listar borradores pendientes de revisión
- **WHEN** un usuario autenticado hace `GET /comunicaciones?estado=PENDIENTE_REVISION`
- **THEN** el sistema responde 200 con la lista de borradores en ese estado, cada uno con cliente, área, etapa, preview, estado y fecha de generación

#### Scenario: Sin sesión activa se rechaza
- **WHEN** se llama a `GET /comunicaciones` sin cookie JWT válida
- **THEN** el sistema responde 401

#### Scenario: Estado inválido se rechaza
- **WHEN** un usuario autenticado envía `GET /comunicaciones?estado=CUALQUIERA` con un valor que no pertenece a `EstadoComunicacion`
- **THEN** el sistema responde 422

### Requirement: Aprobar o descartar un borrador

El sistema SHALL exponer `PATCH /comunicaciones/{id}` que permita cambiar el estado de un borrador a `APROBADO` o `DESCARTADO`, autenticado por cookie JWT con rol `ABOGADO` o `SOCIO` (`require_roles`), con protección CSRF double-submit, rate limiting y validación Pydantic que restrinja el `estado` entrante a `APROBADO`/`DESCARTADO`. Aprobar SHALL registrar `aprobado_por` (usuario actual) y `aprobado_en` (ahora), y con ello SHALL reiniciar la ventana de cadencia de 15 días del caso. El endpoint NUNCA SHALL enviar la comunicación al cliente; el envío por WhatsApp es una acción externa y manual (RN-10, RN-19).

#### Scenario: Aprobar un borrador
- **WHEN** un usuario ABOGADO o SOCIO hace `PATCH /comunicaciones/{id}` con `{ "estado": "APROBADO" }` sobre un borrador en `PENDIENTE_REVISION`
- **THEN** el sistema marca el borrador como `APROBADO`, registra `aprobado_por` y `aprobado_en`, no envía nada al cliente, y la próxima ventana de actualización del caso vence 15 días después

#### Scenario: Descartar un borrador
- **WHEN** un usuario ABOGADO o SOCIO hace `PATCH /comunicaciones/{id}` con `{ "estado": "DESCARTADO" }`
- **THEN** el sistema marca el borrador como `DESCARTADO` y no lo cuenta como actualización para la cadencia

#### Scenario: Estado no permitido se rechaza
- **WHEN** se envía `PATCH /comunicaciones/{id}` con `{ "estado": "PENDIENTE_REVISION" }` u otro valor no permitido
- **THEN** el sistema responde 422 sin cambiar el recurso

#### Scenario: Sin rol suficiente se rechaza
- **WHEN** un usuario sin rol ABOGADO/SOCIO, o sin token CSRF válido, intenta el PATCH
- **THEN** el sistema responde 403

#### Scenario: Borrador inexistente
- **WHEN** se hace `PATCH /comunicaciones/{id}` para un `id` que no existe
- **THEN** el sistema responde 404

### Requirement: Revisión de borradores en la interfaz

La interfaz SHALL ofrecer una pantalla de revisión de borradores que liste los borradores `PENDIENTE_REVISION` traídos de `GET /comunicaciones`, permita seleccionar uno, mostrar cliente/área/etapa y el contenido editable, y ejecutar las acciones editar, copiar, aprobar y descartar contra `PATCH /comunicaciones/{id}`. Los nombres de área y etapa SHALL provenir del backend (no hardcodeados). La interfaz NO SHALL ofrecer ninguna acción de envío automático al cliente; SHALL comunicar que el abogado revisa y aprueba antes de enviar manualmente (RN-10).

#### Scenario: Revisar y aprobar desde la interfaz
- **WHEN** el abogado abre la pantalla de revisión, selecciona un borrador, lo edita si hace falta y presiona "Aprobar"
- **THEN** la interfaz llama a `PATCH /comunicaciones/{id}` con `APROBADO`, refleja el borrador como aprobado y no dispara ningún envío

#### Scenario: Copiar el borrador aprobado
- **WHEN** el abogado presiona "Copiar" sobre un borrador
- **THEN** la interfaz copia el texto al portapapeles para pegarlo manualmente en WhatsApp (acción externa)

#### Scenario: La interfaz muestra datos reales, no mock
- **WHEN** se abre la pantalla de revisión
- **THEN** la lista y el contenido provienen de `GET /comunicaciones?estado=PENDIENTE_REVISION` y no de datos hardcodeados
