## ADDED Requirements

### Requirement: Generar y persistir un borrador de actualización (individual)
El sistema SHALL proveer `POST /casos/{id}/actualizacion` que valide sesión por cookie JWT y rol (ABOGADO o SOCIO) y CSRF, dispare la generación del borrador en n8n (WF-01) vía webhook, persista el resultado en la tabla `comunicacion` con `tipo=MANUAL` y `estado=PENDIENTE_REVISION`, y devuelva el borrador con su `id`. El backend NO SHALL contener lógica de IA (sin LLM, claves de OpenAI ni prompts) y NO SHALL enviar la comunicación al cliente (RF-16, RF-18, RN-10, ADR-0003).

#### Scenario: Generación exitosa
- **WHEN** un ABOGADO autenticado envía `POST /casos/1/actualizacion` con el CSRF token correcto y n8n (WF-01) responde con el texto del borrador
- **THEN** responde `200` con `{ "id": <int>, "borrador": "<texto>", "generado_en": "<ISO-8601>" }`
- **AND** persiste una fila en `comunicacion` con `caso_id=1`, `tipo=MANUAL`, `estado=PENDIENTE_REVISION`, `contenido=<texto>` y `aprobado_por`/`aprobado_en` en `NULL`

#### Scenario: Servicio de IA no disponible
- **WHEN** la llamada al webhook de WF-01 falla (timeout, conexión rechazada, 5xx de n8n o respuesta sin texto utilizable)
- **THEN** responde `503` con un body que indica que la IA no está disponible y habilita la redacción manual
- **AND** NO persiste ninguna fila en `comunicacion`

#### Scenario: Sin sesión
- **WHEN** se llama `POST /casos/1/actualizacion` sin cookie de acceso
- **THEN** responde `401`

#### Scenario: Sin CSRF
- **WHEN** la mutación se realiza sin el header `X-CSRF-Token` (o no coincide con la cookie)
- **THEN** responde `403`

#### Scenario: Caso inexistente
- **WHEN** `caso_id` no existe en la base de datos
- **THEN** responde `404` y no dispara el webhook

### Requirement: Exponer contexto seguro del caso a n8n (herramienta interna)
El sistema SHALL proveer `GET /internal/casos/{id}/contexto`, de solo lectura, que el nodo AI Agent de n8n consume como herramienta. SHALL autenticarse mediante un secreto compartido server-to-server (NO la cookie JWT de usuario) y devolver únicamente datos seguros del caso: nombre del cliente, etapa actual y últimas novedades. NO SHALL exponer datos sensibles innecesarios (DNI/CUIL, datos de terceros, montos ni plazos) ni ser accesible desde el frontend (RF-16, ADR-0003, ADR-0004).

#### Scenario: Contexto con secreto válido
- **WHEN** n8n envía `GET /internal/casos/1/contexto` con el header del secreto compartido correcto
- **THEN** responde `200` con `{ "cliente": "<nombre>", "etapa": "<etapa actual>", "ultimas_novedades": ["<novedad>", ...] }`

#### Scenario: Caso sin novedades
- **WHEN** el caso existe pero no tiene novedades recientes
- **THEN** responde `200` con `ultimas_novedades` como lista vacía `[]`

#### Scenario: Secreto ausente o inválido
- **WHEN** se llama sin el header del secreto compartido, o con un valor incorrecto
- **THEN** responde `401` y no devuelve datos del caso

#### Scenario: No requiere cookie de usuario
- **WHEN** se llama con el secreto compartido válido pero sin cookie de sesión JWT
- **THEN** responde `200` (el endpoint interno no depende de la sesión de usuario)

#### Scenario: Caso inexistente
- **WHEN** `caso_id` no existe
- **THEN** responde `404`

### Requirement: Ningún envío automático — humano en el bucle
El sistema SHALL garantizar que ninguna comunicación al cliente se envíe de forma automática. La generación del borrador SHALL producir siempre una `comunicacion` en estado `PENDIENTE_REVISION` que el abogado revisa y edita; el envío al cliente (p. ej. WhatsApp) es una acción externa y manual fuera del sistema (RF-18, RN-10, RNF-04).

#### Scenario: El estado inicial siempre es PENDIENTE_REVISION
- **WHEN** se genera un borrador individual vía `POST /casos/{id}/actualizacion`
- **THEN** la `comunicacion` persistida queda en `estado=PENDIENTE_REVISION` y el sistema no ejecuta ningún envío

#### Scenario: El borrador es editable antes de usarse
- **WHEN** el abogado recibe el borrador en el frontend
- **THEN** puede editar el texto antes de copiarlo/usarlo, y la interfaz indica explícitamente que el envío al cliente es manual (no automático)
