## ADDED Requirements

### Requirement: Listar borradores de comunicación por estado

El sistema SHALL exponer `GET /api/v1/comunicaciones` que devuelva los borradores de comunicación (entidad `Comunicacion`), con filtro opcional por `estado` (query param validado contra el enum `EstadoComunicacion`). Cada ítem SHALL incluir los datos necesarios para revisarlo sin llamadas adicionales, resolviendo las relaciones `Comunicacion → Caso → Cliente` y `Caso → etapa_actual`: `id`, `caso_id`, `cliente` (nombre completo), `area` (LABORAL/ART), `etapa` (nombre de la etapa actual), `preview` (el campo `contenido`), `estado` y `generado_en`. Los resultados SHALL ordenarse por `generado_en` descendente. El endpoint SHALL requerir sesión activa (JWT en cookie) y estar limitado por rate limit; la lectura está permitida a todo usuario autenticado (RN-08).

#### Scenario: Listar solo los pendientes de revisión

- **WHEN** un usuario autenticado hace `GET /api/v1/comunicaciones?estado=PENDIENTE_REVISION`
- **THEN** el sistema responde 200 con la lista de borradores en estado `PENDIENTE_REVISION`, cada uno con `id`, `caso_id`, `cliente`, `area`, `etapa`, `preview`, `estado` y `generado_en`, ordenados por `generado_en` descendente

#### Scenario: Sin borradores pendientes

- **WHEN** un usuario autenticado consulta `GET /api/v1/comunicaciones?estado=PENDIENTE_REVISION` y no hay borradores en ese estado
- **THEN** el sistema responde 200 con una lista vacía

#### Scenario: Estado inválido

- **WHEN** se envía un `estado` que no pertenece al enum `EstadoComunicacion`
- **THEN** el sistema responde 422 sin devolver datos

#### Scenario: Sin sesión activa

- **WHEN** se hace la petición sin cookie de sesión válida
- **THEN** el sistema responde 401

### Requirement: Aprobar o descartar un borrador de comunicación

El sistema SHALL exponer `PATCH /api/v1/comunicaciones/{id}` que permita cambiar el estado de un borrador a `APROBADO` o `DESCARTADO` mediante el body `{ "estado": "APROBADO" | "DESCARTADO" }`. La transición SHALL permitirse únicamente desde `PENDIENTE_REVISION` (RN-19). Al aplicarse, el sistema SHALL registrar `aprobado_por` con el id del usuario que realiza la acción y `aprobado_en` con la marca de tiempo actual. El endpoint SHALL requerir rol ABOGADO o SOCIO, validación CSRF (double-submit) y rate limit. El sistema NO SHALL enviar ninguna comunicación al cliente como efecto de esta acción (RN-10).

#### Scenario: Aprobar un borrador pendiente

- **WHEN** un usuario con rol ABOGADO o SOCIO hace `PATCH /api/v1/comunicaciones/{id}` con `{ "estado": "APROBADO" }` sobre un borrador en `PENDIENTE_REVISION`
- **THEN** el sistema responde 200 con el recurso actualizado (`id`, `estado="APROBADO"`, `aprobado_por`, `aprobado_en`) y no envía nada al cliente

#### Scenario: Descartar un borrador pendiente

- **WHEN** un usuario con rol ABOGADO o SOCIO hace `PATCH /api/v1/comunicaciones/{id}` con `{ "estado": "DESCARTADO" }` sobre un borrador en `PENDIENTE_REVISION`
- **THEN** el sistema responde 200 con `estado="DESCARTADO"` y registra `aprobado_por` y `aprobado_en` como traza de quién revisó

#### Scenario: Borrador ya resuelto

- **WHEN** se hace `PATCH` sobre un borrador que no está en `PENDIENTE_REVISION`
- **THEN** el sistema responde 409 sin modificar el recurso

#### Scenario: Estado destino inválido

- **WHEN** el body trae un `estado` distinto de `APROBADO` o `DESCARTADO`
- **THEN** el sistema responde 422

#### Scenario: Comunicación inexistente

- **WHEN** se hace `PATCH` sobre un `id` que no existe
- **THEN** el sistema responde 404

#### Scenario: Sin permiso de rol

- **WHEN** un usuario autenticado sin rol ABOGADO ni SOCIO intenta la mutación, o falta el token CSRF
- **THEN** el sistema responde 403
