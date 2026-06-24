# Modelo de Datos

Base relacional normalizada en PostgreSQL. El esquema ejecutable está en `modelo-de-datos.dbml`; las relaciones e invariantes, en `README.md`.

## Decisión central: estados como datos

El estado de un caso **no** es un enum fijo. Cada área (Laboral, ART) tiene su propio ciclo de vida con muchas etapas, modeladas como datos en `etapa` (catálogo) y `transicion_etapa` (transiciones permitidas). El caso apunta a su `etapa_actual_id`. Ver ADR-0008.

## Entidades

| Entidad | Descripción |
|---------|-------------|
| `usuario` | Personal del estudio (todos abogados). Roles SOCIO / ABOGADO. |
| `refresh_token` | Control de sesiones para revocación de refresh tokens (seguridad). |
| `cliente` | Persona representada. Datos de la persona del formulario de admisión (nombre, DNI, CUIL, domicilio). |
| `caso` | Expediente. Tiene área, etapa actual, cliente y abogado responsable; en ART, tipo de reclamo. |
| `ficha_laboral` | Datos del trabajo y registración (admisión). 1:1 con el caso. |
| `etapa` | Catálogo configurable de etapas por área y fase (extrajudicial/judicial), con orden y `es_terminal`. |
| `transicion_etapa` | Transiciones permitidas entre etapas (grafo del flujo). |
| `historial_caso` | Bitácora **inmutable** de avances/retrocesos de etapa. |
| `telegrama` | Telegramas del flujo Laboral (Ley 23.789), hasta 3 por caso, con resultado de entrega. |
| `documento` | Metadata de archivos del caso (categoría + formato); el binario vive en R2. |
| `vencimiento` | Ítems de agenda / movimientos a realizar. |
| `comunicacion` | Borradores de mensajes al cliente (manuales y batch automático). |
| `backup` | Historial de respaldos (los ejecuta n8n). |

## Notas de integridad (capa de servicio)

- `caso.etapa_actual_id` debe apuntar a una etapa de la **misma área** que el caso.
- `caso.tipo_reclamo` se completa solo en ART; NULL en Laboral.
- `telegrama` solo aplica a casos Laborales (RN-15).
- `ficha_laboral` es 1:1 por caso.
- `historial_caso` es append-only (RN-06).
- `documento.subido_por` siempre es un usuario; el cliente no sube (RN-12).
- `comunicacion` no se envía sola; el paso a `APROBADO` lo hace una persona (RN-10).
- Etapas únicas por `(area, nombre)`.

Detalle de relaciones y cardinalidades en `README.md`.
