# Feature — Generador de Telegramas (Ley 23.789)

## Objetivo

Generar, desde un caso del área Laboral, el **telegrama laboral oficial (Ley N.º 23.789)** completando automáticamente el formulario a partir de los datos del caso, para reemplazar el armado manual actual.

## Contexto

Hoy el estudio completa los datos del telegrama sobre una plantilla en una herramienta de diseño gráfico (Canva) — proceso manual, lento y propenso a errores (Relevamiento §12). Existe un prototipo funcional que rellena el formulario oficial en PDF del lado del cliente. Esta feature integra ese prototipo como funcionalidad nativa de la aplicación.

> **Importante:** esta feature **no usa IA** y **no pasa por n8n**. Es un llenado de formulario **determinístico** que corre en el frontend (pdf-lib). No confundir con la generación de comunicaciones (que sí es IA en n8n).

## Alcance

**Incluido**
- Prellenado del formulario oficial a partir de los datos del caso, cliente y ficha laboral.
- Edición de los campos por el abogado antes de generar.
- Generación del PDF del telegrama (formulario oficial Ley 23.789).
- Descarga del PDF y, opcionalmente, guardado como `documento` del caso (en R2) y registro del `telegrama` (número 1, 2 o 3) con su resultado de entrega.

**Fuera de alcance**
- Envío del telegrama al correo (lo hace el cliente/estudio de forma presencial).
- OCR o lectura automática de datos.

## Actores

Abogado (cualquier rol con acceso al caso Laboral).

## Requisitos funcionales

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-25.1 | Desde un caso Laboral, generar un telegrama con el formulario oficial prellenado. | M |
| RF-25.2 | Permitir editar todos los campos antes de generar el PDF. | M |
| RF-25.3 | Descargar el PDF generado. | M |
| RF-25.4 | Guardar el PDF como documento del caso y registrar el telegrama (número y datos). | S |

## Campos del formulario (oficial Ley 23.789)

El prototipo usa un **PDF rellenable real** (`pdf-lib`, `form.getTextField(name)` / `form.getRadioGroup(name)`). Los nombres de campo de la tabla son **exactos**, tal como están definidos en el PDF oficial — deben usarse literalmente al llamar `getTextField()`, no son una convención propia.

| Bloque | Campo del PDF (nombre exacto) | Origen (prellenado) |
|--------|-------------------------------|---------------------|
| Destinatario (empleador) | `Apellido y nombre o razón social` | `ficha_laboral.razon_social` / `empleador_nombre` |
| Destinatario | `Ramo o actividad principal` | `ficha_laboral.ramo_actividad` |
| Destinatario | `Domicilio laboral` | `ficha_laboral.direccion_trabajo` |
| Destinatario | `CP` | `ficha_laboral.direccion_trabajo_cp` |
| Destinatario | `Localidad` | `ficha_laboral.direccion_trabajo_localidad` |
| Destinatario | `Provincia` | `ficha_laboral.direccion_trabajo_provincia` |
| Remitente (trabajador) | `Apellido y nombre REMITENTE` | `cliente.nombre` |
| Remitente | `N° DNI REMITENTE` | `cliente.dni` |
| Remitente | `Fecha` | Fecha de generación |
| Remitente | `Domicilio real` | `cliente.domicilio_real` |
| Remitente | `CP REMITENTE` | `cliente.domicilio_real_cp` |
| Remitente | `Localidad REMITENTE` | `cliente.domicilio_real_localidad` |
| Remitente | `Provincia REMITENTE` | `cliente.domicilio_real_provincia` |
| Texto | `Campo de texto` | `telegrama.cuerpo` (editable) |

### Tipo de comunicación (radio group del PDF)

El PDF tiene un **grupo de radio buttons** llamado `Opciones de comunicación` con 3 valores fijos del formulario oficial:

| Valor del radio | Etiqueta del formulario | Uso en Iuris |
|------------------|--------------------------|--------------|
| `Opción1` | Comunicación de renuncia | No aplica al caso de uso actual |
| `Opción2` | Comunicación de ausencia | No aplica al caso de uso actual |
| `Opción3` | Otro tipo de comunicación | **Selección por defecto** — es la que corresponde a la intimación laboral del estudio |

Se selecciona con `form.getRadioGroup('Opciones de comunicación').select('Opción3')`. Se modela en el dominio como `telegrama.tipo_comunicacion` (enum `RENUNCIA` / `AUSENCIA` / `OTRO`, default `OTRO`), por si el estudio llegara a necesitar las otras opciones a futuro.

### Validación de extensión del mensaje

Este formato específico del PDF está pensado para mensajes de **más de 30 palabras**; el prototipo muestra un aviso ("este formato es para más de 30") cuando el texto es más corto. El frontend debe replicar esa validación (advertencia, no bloqueo) sobre `Campo de texto` / `telegrama.cuerpo`.

## Reglas de negocio

| ID | Regla |
|----|-------|
| RN-15 | El generador de telegramas solo aplica a casos del área **Laboral**. |
| RN-16 | Un caso admite hasta **3 telegramas** (número 1, 2 o 3); ver `telegrama` (único por `caso_id + numero`). |
| RN-17 | El abogado **revisa y confirma** los datos prellenados antes de generar el PDF (control humano). |
| RN-18 | Al guardar, el PDF se asocia al caso como `documento` y se crea/actualiza el registro `telegrama` con su resultado de entrega inicial `PENDIENTE`. |

## Caso de uso

### UC-09 — Generar telegrama de un caso Laboral
**Actor:** Abogado · **Precondición:** caso Laboral existente.
**Flujo principal:**
1. Desde el caso, el abogado elige "Generar telegrama" e indica el número (1, 2 o 3).
2. El sistema prellena el formulario oficial con los datos del caso, cliente y ficha laboral.
3. El abogado revisa, completa el texto del reclamo y confirma.
4. El sistema genera el PDF del telegrama (pdf-lib, en el navegador).
5. El abogado descarga el PDF y, opcionalmente, lo guarda como documento del caso.
6. Si se guarda, el sistema registra el `telegrama` (número, datos, resultado `PENDIENTE`).
**Flujos alternativos:**
- 2a. Faltan datos para prellenar → el sistema deja los campos vacíos para completar manualmente.

*(RF-25.x, RN-15..18)*

## Arquitectura / implementación

- **Determinístico, sin IA, sin n8n.** Llenado de formulario en el **frontend** con `pdf-lib`, sobre el PDF rellenable oficial (incluido como recurso de la app, embebido o cargado por fetch).
- Prellenado desde la API (`GET /casos/{id}` + `ficha_laboral`).
- Implementación (referencia del prototipo validado):
  ```js
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.load(PDF_BYTES);
  const form = doc.getForm();
  // Texto: un getTextField().setText() por cada campo de la tabla anterior,
  // usando el nombre EXACTO del PDF (no traducir ni normalizar el nombre).
  form.getTextField('Apellido y nombre o razón social').setText(empleador.razonSocial);
  // ... resto de los campos de texto ...
  // Radio: una sola selección del grupo "Opciones de comunicación"
  form.getRadioGroup('Opciones de comunicación').select('Opción3'); // default: OTRO
  const bytes = await doc.save();
  ```
- Manejar con `try/catch` por campo (`form.getTextField(name)` puede lanzar si el nombre no existe en esa versión del PDF); registrar en consola los campos no encontrados sin interrumpir la generación.
- El PDF resultante puede subirse a R2 con el flujo estándar de documentos (URL prefirmada) y registrarse vía `POST /casos/{id}/documentos` + creación del `telegrama`.

## Criterios de aceptación

- Dado un caso Laboral con datos, al generar un telegrama el formulario aparece prellenado y editable.
- El PDF generado respeta el formulario oficial y admite caracteres acentuados.
- Al guardar, queda un documento asociado al caso y un registro de telegrama con su número.
