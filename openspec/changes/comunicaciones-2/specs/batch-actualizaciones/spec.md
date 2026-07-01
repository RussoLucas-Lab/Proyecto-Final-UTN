## ADDED Requirements

### Requirement: Detección diaria de casos pendientes de actualización

El sistema SHALL exponer un endpoint interno `GET /internal/casos/pendientes-actualizacion`, protegido por el secreto compartido `X-Internal-Secret`, que devuelva la lista de `caso_id` que "vencen" hoy para su actualización de 15 días. El cálculo de la cadencia SHALL residir en el backend, no en n8n. Un caso SHALL considerarse pendiente cuando se cumplen TODAS las condiciones: (a) su etapa actual NO es terminal (`Etapa.es_terminal == False`, RN-20); (b) no existe para el caso ninguna `comunicacion` con `tipo=ACTUALIZACION_AUTOMATICA` y `estado=PENDIENTE_REVISION` (idempotencia, RN-22); (c) han transcurrido ≥15 días desde la última `comunicacion` `ACTUALIZACION_AUTOMATICA` en estado `APROBADO` (por su `aprobado_en`), o desde `caso.fecha_inicio` si nunca hubo una, o desde `caso.creado_en` si `fecha_inicio` es NULL (RN-21).

#### Scenario: Caso activo que cumple 15 días aparece como pendiente
- **WHEN** n8n llama a `GET /internal/casos/pendientes-actualizacion` con el secreto válido y existe un caso en etapa no terminal cuya última actualización automática aprobada fue hace ≥15 días
- **THEN** el sistema responde 200 con una lista que incluye el `caso_id` de ese caso

#### Scenario: Caso en etapa terminal se excluye
- **WHEN** se calcula la lista de pendientes y un caso está en una etapa con `es_terminal = true`
- **THEN** ese `caso_id` NO aparece en la lista (RN-20)

#### Scenario: Caso con borrador automático pendiente no se re-detecta (idempotencia)
- **WHEN** un caso ya tiene una `comunicacion` `ACTUALIZACION_AUTOMATICA` en estado `PENDIENTE_REVISION`
- **THEN** ese `caso_id` NO aparece en la lista de pendientes (RN-22)

#### Scenario: Caso que aún no cumple 15 días se excluye
- **WHEN** un caso activo tuvo su última actualización automática aprobada hace menos de 15 días
- **THEN** ese `caso_id` NO aparece en la lista

#### Scenario: Caso sin actualizaciones previas usa fecha_inicio
- **WHEN** un caso activo nunca tuvo una `comunicacion` automática aprobada y su `fecha_inicio` fue hace ≥15 días
- **THEN** ese `caso_id` aparece en la lista

#### Scenario: Sin secreto interno se rechaza
- **WHEN** se llama al endpoint sin el header `X-Internal-Secret` o con un valor inválido
- **THEN** el sistema responde 401 y no devuelve datos

### Requirement: Persistencia de borradores automáticos vía endpoint interno

El sistema SHALL exponer un endpoint interno `POST /internal/casos/{id}/comunicaciones`, protegido por `X-Internal-Secret`, que persista un borrador generado por el agente de n8n como `comunicacion` con `tipo=ACTUALIZACION_AUTOMATICA` y `estado=PENDIENTE_REVISION`. El endpoint NO SHALL disparar ningún envío al cliente (RN-19). El sistema NO SHALL crear un segundo borrador automático `PENDIENTE_REVISION` para un caso que ya tenga uno (idempotencia, RN-22).

#### Scenario: Persistir un borrador generado
- **WHEN** n8n envía `POST /internal/casos/{id}/comunicaciones` con el secreto válido y un `contenido` no vacío
- **THEN** el sistema crea una `comunicacion(tipo=ACTUALIZACION_AUTOMATICA, estado=PENDIENTE_REVISION)` para ese caso y responde con el recurso creado, sin enviar nada al cliente

#### Scenario: Caso inexistente
- **WHEN** se hace `POST /internal/casos/{id}/comunicaciones` para un `id` de caso que no existe
- **THEN** el sistema responde 404

#### Scenario: Idempotencia en la persistencia
- **WHEN** ya existe un borrador `ACTUALIZACION_AUTOMATICA` `PENDIENTE_REVISION` para el caso y se intenta crear otro
- **THEN** el sistema NO crea un segundo borrador (responde 409 o devuelve el existente sin duplicar)

#### Scenario: Sin secreto interno se rechaza
- **WHEN** se llama al endpoint sin `X-Internal-Secret` válido
- **THEN** el sistema responde 401 y no persiste nada

### Requirement: Workflow WF-05 orquesta el batch reutilizando el agente de WF-01

El sistema SHALL incluir un workflow de n8n `WF-05` que, disparado por un Schedule Trigger diario, consulte `GET /internal/casos/pendientes-actualizacion`, itere los casos devueltos, genere un borrador por caso con el MISMO AI Agent de WF-01 (OpenAI Chat Model + herramienta `obtener_contexto_caso`) y persista cada borrador vía `POST /internal/casos/{id}/comunicaciones`. Los secretos (`N8N_INTERNAL_SECRET`, credencial OpenAI) SHALL gestionarse como credenciales/variables de n8n y NUNCA hardcodearse en el JSON del workflow. El contenido SHALL respetar las mismas restricciones que WF-01: sin plazos ni montos, lenguaje simple (RN-23).

#### Scenario: Ejecución diaria genera un borrador por caso pendiente
- **WHEN** el Schedule Trigger de WF-05 se dispara y el endpoint de pendientes devuelve una lista no vacía
- **THEN** WF-05 genera un borrador por cada caso y lo persiste como `PENDIENTE_REVISION`, sin enviar nada al cliente

#### Scenario: Lista de pendientes vacía termina sin generar
- **WHEN** el endpoint de pendientes devuelve una lista vacía
- **THEN** WF-05 finaliza sin invocar al AI Agent ni persistir borradores

#### Scenario: Ningún secreto embebido en el JSON del workflow
- **WHEN** se revisa `n8n/workflows/WF-05-batch-actualizaciones.json`
- **THEN** no contiene el valor de `N8N_INTERNAL_SECRET` ni la clave de OpenAI en texto plano; usa credenciales/variables de n8n
