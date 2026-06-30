## Why

El estudio no tiene forma de registrar ni visualizar los movimientos procesales próximos (audiencias, presentaciones, notificaciones). Sin agenda de vencimientos, los abogados dependen de notas externas y el riesgo de perder un plazo es alto.

## What Changes

- `POST /casos/{id}/vencimientos` — registrar un movimiento con descripción y fecha para un caso
- `GET /vencimientos?desde=&hasta=` — listar movimientos de todo el estudio en un rango de fechas (vista calendario compartida)
- `PATCH /vencimientos/{id}` — marcar un movimiento como completado
- Frontend: sección "Vencimientos" en el detalle de caso (lista + formulario de alta) y página `/agenda` con vista calendario mensual

## Capabilities

### New Capabilities

- `agenda-vencimientos`: Registro y visualización de movimientos procesales por caso y vista calendario compartida del estudio (RF-19, RF-20, UC-11)

### Modified Capabilities

*(ninguna — la tabla `vencimiento` ya existe en la migración 001, sin cambios de esquema)*

## Impact

- **Backend**: nueva feature `features/vencimientos/` (schemas, service, router) registrada en `main.py`
- **Frontend**: sección en `CasoARTPage` y `CasoLaboralPage` + nueva página `AgendaPage` en `/agenda`
- **DB**: tabla `vencimiento` ya creada en migración `001_esquema_base_inicial.py` — sin nueva migración
- **Sin dependencias externas** (sin n8n, sin storage)
