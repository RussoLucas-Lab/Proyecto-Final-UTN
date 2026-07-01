## ADDED Requirements

### Requirement: Métricas de resumen del estudio

El sistema SHALL exponer `GET /api/v1/dashboard/resumen` que devuelva los conteos agregados que alimentan las tarjetas del panel de inicio, calculados server-side a partir de datos ya persistidos (sin migración de esquema): total de casos por área (LABORAL y ART) con su delta del mes calendario en curso, y cantidad de clientes creados en los últimos 30 días. La respuesta SHALL tener la forma `{ "casos_laboral": {"total", "delta_mes"}, "casos_art": {"total", "delta_mes"}, "clientes_nuevos_30d" }`. `delta_mes` SHALL contar los casos con `creado_en` dentro del mes en curso; `clientes_nuevos_30d` SHALL contar los clientes con `creado_en` dentro de la ventana móvil de 30 días. El endpoint SHALL requerir sesión activa (JWT en cookie) y estar limitado por rate limit.

#### Scenario: Resumen con datos

- **WHEN** un usuario autenticado hace `GET /api/v1/dashboard/resumen`
- **THEN** el sistema responde 200 con `casos_laboral` y `casos_art` (cada uno con `total` y `delta_mes`) y `clientes_nuevos_30d`, reflejando los conteos reales de la base

#### Scenario: Estudio sin datos

- **WHEN** no hay casos ni clientes cargados
- **THEN** el sistema responde 200 con todos los totales y deltas en 0

#### Scenario: Sin sesión activa

- **WHEN** se hace la petición sin cookie de sesión válida
- **THEN** el sistema responde 401

### Requirement: Dashboard poblado con datos reales

El panel de inicio (`frontend/src/features/dashboard`) SHALL mostrar exclusivamente datos obtenidos del backend, sin valores hardcodeados. La fecha del encabezado SHALL ser la fecha real actual (`new Date()`). Las tarjetas de métricas SHALL poblarse desde `GET /api/v1/dashboard/resumen`. La tabla "Actualizaciones para revisar", su badge y el contador del botón "Revisar actualizaciones" SHALL poblarse desde `GET /api/v1/comunicaciones?estado=PENDIENTE_REVISION`, siendo el contador igual a la cantidad de borradores devueltos. La tarjeta "Vencimientos próximos" y el panel "Próximos vencimientos" SHALL derivarse de una única consulta `GET /api/v1/vencimientos?desde=&hasta=` sobre un horizonte próximo. Mientras cargan los datos, la pantalla SHALL indicar estado de carga y, ante error, SHALL mostrar un mensaje en lugar de valores inventados.

#### Scenario: Carga inicial con datos reales

- **WHEN** el abogado abre el dashboard
- **THEN** ve la fecha actual real, las métricas de casos/clientes traídas de `/dashboard/resumen`, la lista real de borradores pendientes (con su badge y botón reflejando la cantidad real) y los vencimientos próximos reales

#### Scenario: Sin borradores pendientes

- **WHEN** no hay comunicaciones en estado `PENDIENTE_REVISION`
- **THEN** la tabla se muestra vacía y tanto el badge como el contador del botón muestran 0

#### Scenario: Error de carga

- **WHEN** una de las consultas del dashboard falla
- **THEN** la sección afectada muestra un mensaje de error en lugar de datos mock

### Requirement: Aprobar o descartar borradores desde el dashboard

Desde la tabla "Actualizaciones para revisar", el usuario SHALL poder aprobar o descartar un borrador; la acción SHALL invocar `PATCH /api/v1/comunicaciones/{id}` y, al completarse, la lista y los contadores (badge y botón) SHALL actualizarse para reflejar el nuevo estado. Ninguna de estas acciones SHALL enviar la comunicación al cliente (RN-10).

#### Scenario: Aprobar un borrador desde la tabla

- **WHEN** el abogado aprueba un borrador de la tabla
- **THEN** el frontend llama a `PATCH /comunicaciones/{id}` con `estado="APROBADO"`, el borrador desaparece de la lista de pendientes y el badge/contador disminuye en 1

#### Scenario: Descartar un borrador desde la tabla

- **WHEN** el abogado descarta un borrador de la tabla
- **THEN** el frontend llama a `PATCH /comunicaciones/{id}` con `estado="DESCARTADO"`, el borrador sale de la lista de pendientes y el contador se actualiza

### Requirement: Estructura vertical-slice de la feature dashboard

La feature `frontend/src/features/dashboard` SHALL seguir la organización vertical-slice del ADR-0009, separando la capa de datos de la presentación: SHALL incluir `api.ts` (funciones tipadas contra `/api/v1/...` usando el cliente `shared/http.ts`), `types.ts` (tipos espejo de los schemas del backend, sin valores hardcodeados), un hook de datos (p. ej. `useDashboard`) que orqueste las lecturas y exponga `{ data, isLoading, error }`, y subcomponentes de presentación. `DashboardPage.tsx` NO SHALL contener datos de dominio hardcodeados.

#### Scenario: Datos provienen de la capa api

- **WHEN** se revisa el código de la feature dashboard
- **THEN** existen `api.ts`, `types.ts` y un hook de datos, y `DashboardPage.tsx` consume esos módulos sin arrays ni cifras de dominio embebidas
