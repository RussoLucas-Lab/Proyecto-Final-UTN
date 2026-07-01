## Why

El estudio completa los telegramas laborales (Ley 23.789) manualmente sobre una plantilla en Canva — proceso lento y propenso a errores. Existe un prototipo validado que rellena el formulario oficial PDF desde el navegador (`pdf-lib`); esta feature lo integra como funcionalidad nativa de Iuris.

## What Changes

- Nueva pantalla en el caso Laboral para generar el telegrama oficial prellenado con datos del caso, cliente y ficha laboral.
- El abogado puede editar todos los campos (incluyendo el texto del reclamo) antes de generar el PDF.
- El PDF se descarga en el navegador (generación client-side con `pdf-lib`, sin backend).
- Opcionalmente el abogado guarda el PDF como `documento` del caso (usa el flujo de documentos ya implementado con R2) y registra el `telegrama` (número 1-3, resultado `PENDIENTE`).
- Dos nuevos endpoints backend: `POST /casos/{id}/telegramas` y `PATCH /telegramas/{id}`.

## Capabilities

### New Capabilities
- `generador-telegramas`: Generación client-side del formulario PDF oficial (Ley 23.789), prellenado desde la API, edición manual de campos, descarga, y registro del telegrama + documento en backend.

### Modified Capabilities
<!-- ninguna: los endpoints de documentos y casos no cambian en su contrato -->

## Impact

- **Frontend**: nueva feature `telegramas/` con `pdf-lib` como dependencia. Prellenado desde `GET /casos/{id}` (ya implementado). Subida a R2 usando el flujo de documentos ya existente.
- **Backend**: dos endpoints nuevos en `features/telegramas/` — `POST /casos/{id}/telegramas` (crea registro con `resultado=PENDIENTE`) y `PATCH /telegramas/{id}` (actualiza resultado). Solo para casos Laborales (RN-15). Máximo 3 telegramas por caso, unicidad `(caso_id, numero)` (RN-16).
- **Sin n8n, sin IA**: generación determinística en el navegador (RF-25, nota arquitectural de `08-features/generador-telegramas.md`).
- **Dependencias existentes usadas**: `GET /casos/{id}` + `ficha_laboral`, `POST /casos/{id}/documentos` (documentos ya implementado).
