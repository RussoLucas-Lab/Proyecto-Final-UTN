## Context

El formulario de telegrama Ley 23.789 es un **PDF rellenable oficial** con campos de texto y un radio group (`Opciones de comunicación`). Existe un prototipo funcional validado que usa `pdf-lib` en el navegador para rellenarlo. Los datos necesarios para el prellenado ya están disponibles en `GET /casos/{id}` (incluye `ficha_laboral` y `cliente`). El flujo de subida a R2 ya está implementado en la feature `documentos`.

## Goals / Non-Goals

**Goals:**
- Integrar el prototipo de `pdf-lib` como feature nativa de Iuris (`frontend/src/features/telegramas/`).
- Prellenar el formulario desde la API existente (`GET /casos/{id}`).
- Implementar `POST /casos/{id}/telegramas` y `PATCH /telegramas/{id}` para registrar el telegrama y su resultado.
- Reutilizar el flujo de documentos existente para subir el PDF a R2 (no reimplementar).

**Non-Goals:**
- Envío electrónico del telegrama (el despacho es presencial).
- OCR o lectura de telegramas recibidos.
- Notificaciones automáticas.
- Soporte para áreas distintas de Laboral.

## Decisions

### D1 — Generación exclusivamente client-side (pdf-lib en el navegador)

El PDF se genera en el frontend con `pdf-lib`, sin pasar por el backend. El PDF rellenable oficial se embebe como recurso estático o se carga por `fetch` desde la carpeta `public/`. El backend nunca toca el PDF.

**Alternativa descartada:** generación server-side (Python `pypdf` o similar) — agrega complejidad al backend y latencia de red innecesaria cuando el prototipo ya validó la generación client-side.

### D2 — Reutilizar el flujo de documentos para la subida a R2

La subida del PDF generado reutiliza `POST /casos/{id}/documentos/init-upload` → `PUT <presigned-url>` → `POST /casos/{id}/documentos` exactamente igual que cualquier otro documento. No se agrega ningún endpoint nuevo de upload; solo se registra el `telegrama` por separado.

**Alternativa descartada:** endpoint único que combine upload + registro telegrama — acopla dos responsabilidades y duplica lógica de storage ya probada.

### D3 — Feature backend mínima: solo registro y actualización de telegrama

`backend/app/features/telegramas/` tiene dos endpoints:
- `POST /casos/{id}/telegramas`: valida área Laboral (RN-15), valida número 1-3, unicidad `(caso_id, numero)` (RN-16), crea con `resultado=PENDIENTE` (RN-18).
- `PATCH /telegramas/{id}`: actualiza el resultado de entrega (`PENDIENTE` → `ENTREGADO` / `RECHAZADO` / `SIN_EFECTO`).

CSRF + RBAC (ABOGADO/SOCIO) + rate limiting en ambos.

### D4 — PDF rellenable embebido como asset estático

El PDF oficial se coloca en `frontend/public/telegrama-oficial.pdf` y se carga con `fetch('/telegrama-oficial.pdf')`. No se distribuye en el bundle de JS (es binario). En caso de actualización del formulario oficial basta con reemplazar el archivo.

### D5 — Manejo defensivo de campos del PDF

Cada `form.getTextField(name).setText(value)` se envuelve en `try/catch` individual. Si el nombre de campo no existe en esa versión del PDF, se registra en consola y se continúa. Esto previene que un campo renombrado rompa la generación completa.

### D6 — Guardar es opcional, no bloquea la descarga

El abogado puede descargar el PDF sin guardarlo. El botón "Guardar como documento" es una acción secundaria que llama al flujo de documentos. Si falla, la descarga ya ocurrió y no hay pérdida de trabajo.

## Risks / Trade-offs

- **[Risk] Campos del PDF oficial renombrados en futuras versiones del formulario** → Mitigación: manejo defensivo por campo (D5); error solo en consola, no bloquea la generación.
- **[Risk] `pdf-lib` no admite caracteres especiales (tildes, ñ)** → El prototipo ya validó soporte de acentos; `pdf-lib` usa UTF-16 internamente. El criterio de aceptación lo verifica explícitamente.
- **[Risk] PDF muy grande para subir en el cliente** → Los telegramas son formularios de 1 página; el tamaño esperado es < 100 KB.
- **[Trade-off] Sin preview del PDF en la app** → Se abre en nueva pestaña con `URL.createObjectURL(blob)`. Una previsualización embebida requeriría un `<iframe>` o librería adicional, fuera del alcance del MVP.
