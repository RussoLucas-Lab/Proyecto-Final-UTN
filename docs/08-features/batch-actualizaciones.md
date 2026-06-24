# Feature — Batch de Actualizaciones cada 15 días (WF-05)

## Objetivo

Generar automáticamente, cada ~15 días por cliente, un **borrador de mensaje de actualización** del estado del caso, de modo que al abrir la aplicación el abogado encuentre los mensajes ya redactados, listos para revisar, aprobar y copiar a WhatsApp.

## Contexto

El estudio actualiza a cada cliente cada 15 días, además de hacerlo a pedido. Hoy ese mensaje lo redacta el abogado administrativo y le toma entre 5 y 10 minutos, en buena parte por buscar la información dispersa (Relevamiento §5). Esta automatización fue identificada como una oportunidad de alto valor y validada con el estudio.

> Esta feature **sí usa IA**: reutiliza el agente de n8n (mismo modelo y herramienta que WF-01, ver `../03-arquitectura/agentes-ia.md`). La diferencia es que se ejecuta **programada y por lote**. Como toda comunicación, **nunca se envía sola**: el abogado revisa y aprueba (RN-10).

## Alcance

**Incluido**
- Detección diaria de los casos que "vencen" para actualización (cadencia de 15 días).
- Generación de un borrador por caso mediante el agente de IA.
- Persistencia de cada borrador como `comunicacion` (tipo `ACTUALIZACION_AUTOMATICA`, estado `PENDIENTE_REVISION`).
- Visualización en el dashboard ("Mensajes listos para revisar") y revisión/aprobación/descarte por el abogado.

**Fuera de alcance**
- Envío automático del mensaje (lo copia y envía el abogado por WhatsApp).

## Actores

Sistema (n8n, programado) genera; Abogado revisa y aprueba.

## Requisitos funcionales

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-26.1 | Detectar diariamente los casos activos que cumplen 15 días desde su última actualización. | S |
| RF-26.2 | Generar un borrador de actualización por cada caso detectado (vía agente n8n). | S |
| RF-26.3 | Persistir los borradores como `comunicacion` en estado `PENDIENTE_REVISION`. | S |
| RF-26.4 | Mostrar los borradores pendientes en el dashboard y permitir revisar, aprobar o descartar. | S |

## Reglas de negocio

| ID | Regla |
|----|-------|
| RN-19 | El batch **nunca envía** comunicaciones; solo genera borradores `PENDIENTE_REVISION` (RN-10). |
| RN-20 | Solo se generan actualizaciones para casos **activos** (etapa no terminal). |
| RN-21 | Cadencia de **15 días**: un caso vence si pasaron ≥15 días desde su última comunicación automática (o desde `fecha_inicio` si no hubo ninguna). |
| RN-22 | **Idempotencia:** no generar más de un borrador automático por ventana. Si ya existe un `PENDIENTE_REVISION` automático para el caso, no se genera otro. |
| RN-23 | El contenido respeta las mismas restricciones que WF-01: **sin plazos ni montos**, lenguaje simple (público vulnerable). |

## Lógica de cadencia

Un caso está "pendiente de actualización" hoy cuando se cumplen **todas**:
1. La etapa actual del caso **no es terminal** (caso activo).
2. No existe una `comunicacion` automática en estado `PENDIENTE_REVISION` para ese caso (idempotencia, RN-22).
3. Pasaron **≥ 15 días** desde la última `comunicacion` automática `APROBADO` del caso; si nunca hubo una, desde `caso.fecha_inicio`.

Al aprobar un borrador (estado → `APROBADO`), la "última actualización" se actualiza, y la próxima vencerá 15 días después.

## Caso de uso

### UC-10 — Revisar y aprobar el batch de actualizaciones
**Actor:** Abogado · **Precondición:** existen borradores `PENDIENTE_REVISION`.
**Flujo principal:**
1. El abogado abre el dashboard y ve el bloque "Mensajes listos para revisar".
2. Selecciona un borrador; el sistema muestra cliente, caso y el texto editable.
3. El abogado edita si hace falta y **aprueba** (estado → `APROBADO`), o lo **descarta** (`DESCARTADO`).
4. El abogado copia el mensaje aprobado y lo envía por WhatsApp (acción externa).
**Postcondición:** el borrador queda `APROBADO`/`DESCARTADO`; nada se envió automáticamente.

*(RF-26.x, RN-19..23)*

## Workflow n8n — WF-05

**Disparador:** Schedule Trigger diario (p. ej. 07:00).

| # | Nodo n8n | Configuración clave |
|---|----------|---------------------|
| 1 | **Schedule Trigger** | Diario por la mañana. |
| 2 | **HTTP Request** | `GET /internal/casos/pendientes-actualizacion` — el backend calcula los casos que vencen hoy (cadencia + activos). Devuelve la lista de `caso_id`. |
| 3 | **IF / Split In Batches** | Si la lista está vacía, fin. Si no, itera por caso. |
| 4 | **AI Agent** | Mismo agente que WF-01 (OpenAI Chat Model + herramienta `obtener_contexto_caso`). Genera el borrador del caso. |
| 5 | **HTTP Request** | `POST /internal/casos/{id}/comunicaciones` — persiste el borrador (`tipo=ACTUALIZACION_AUTOMATICA`, `estado=PENDIENTE_REVISION`). |
| 6 | **(opcional) Log/summary** | Registra cuántos borradores se generaron. |

> La cadencia y la persistencia viven en el **backend** (endpoints internos); n8n orquesta y genera con IA. Coherente con "la IA solo en n8n, el backend sin IA".

## Endpoints involucrados

- `GET /internal/casos/pendientes-actualizacion` — casos que vencen hoy (uso interno, protegido por secreto).
- `POST /internal/casos/{id}/comunicaciones` — persiste un borrador (uso interno).
- `GET /comunicaciones?estado=PENDIENTE_REVISION` — listado para el dashboard.
- `PATCH /comunicaciones/{id}` — aprobar o descartar (`{ "estado": "APROBADO" | "DESCARTADO" }`).

## Datos

Tabla `comunicacion` (DBML v2): `tipo=ACTUALIZACION_AUTOMATICA`, `estado` en `PENDIENTE_REVISION → APROBADO/DESCARTADO`, `generado_en`, `aprobado_por`, `aprobado_en`.

## Criterios de aceptación

- Un caso activo que cumple 15 días genera **un** borrador `PENDIENTE_REVISION` (no más de uno por ventana).
- Los casos en etapa terminal **no** generan borradores.
- Ningún borrador se envía automáticamente; el cambio a `APROBADO` lo hace una persona.
- Los borradores aparecen en el dashboard listos para revisar.
