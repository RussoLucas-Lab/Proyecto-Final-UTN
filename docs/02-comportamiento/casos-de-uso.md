# Casos de Uso (UC)

Roles: SOCIO, ABOGADO. Las etapas referidas son datos por área (ver `03-arquitectura/diagramas.md`).

---

## UC-01 — Iniciar sesión
**Actor:** Usuario · **Precondición:** usuario registrado y activo.
**Flujo principal:** valida credenciales → emite access y refresh token en cookies seguras → muestra el panel según rol.
**Alternativo:** credenciales inválidas → error, sin sesión. *(RF-01, RF-02)*

## UC-02 — Ingresar cliente (admisión)
**Actor:** Abogado.
**Flujo principal:** completa el formulario de admisión (datos de la persona; y si corresponde, ficha laboral) → el sistema valida DNI único y persiste. *(RF-05, RN-03)*

## UC-03 — Crear caso
**Actor:** Abogado.
**Flujo principal:**
1. Selecciona "Nuevo caso", asocia un cliente y elige el **área** (Laboral / ART).
2. En ART, indica el tipo de reclamo (accidente / enfermedad).
3. El sistema crea el caso en su **etapa inicial** ("Toma del cliente") y registra la primera entrada de historial.
*(RF-08, RF-09, RN-01, RN-05, RN-11)*

## UC-04 — Avanzar / retroceder etapa
**Actor:** Abogado · **Precondición:** caso existente.
**Flujo principal:**
1. Desde el caso, el abogado marca el avance a la siguiente etapa.
2. El sistema verifica que exista una transición válida desde la etapa actual; actualiza la etapa e inserta historial.
**Alternativo (retroceso):** el abogado solicita retroceder → el sistema pide **confirmación** → registra el movimiento.
**Postcondición:** si la nueva etapa es terminal, el caso queda cerrado. *(RF-10, RF-11, RN-04, RN-05, RN-09)*

## UC-05 — Subir documento a un caso
**Actor:** Abogado.
**Flujo principal:** abre el caso, arrastra archivos → el sistema valida formato, obtiene una URL prefirmada, sube a R2 y registra la metadata. **El cliente no sube.** *(RF-14, RN-02, RN-12)*

## UC-06 — Generar actualización para el cliente (IA)
**Actor:** Abogado.
**Flujo principal:** presiona "Generar actualización" → el backend dispara WF-01 en n8n → el agente devuelve un borrador → el abogado revisa, edita y aprueba → copia y envía por WhatsApp (acción humana). **Nunca se envía solo.** *(RF-16, RF-18, RN-10)*

## UC-07 — Generar telegrama (Laboral)
Ver `08-features/generador-telegramas.md` (UC-09). *(RF-25)*

## UC-08 — Revisar batch de actualizaciones
Ver `08-features/batch-actualizaciones.md` (UC-10). *(RF-26)*

## UC-13 — Gestionar usuarios
**Actor:** SOCIO · **Precondición:** sesión de un socio.
**Flujo principal:** lista los usuarios → crea uno nuevo (nombre, email, rol, área, matrícula), edita o **desactiva** (baja lógica). Solo el rol SOCIO puede operar aquí. *(RF-03, RN-07)*

## UC-11 — Consultar agenda de vencimientos
**Actor:** Abogado.
**Flujo principal:** abre la vista de calendario → ve los movimientos a realizar (de todo el estudio) con su fecha y descripción. *(RF-20)*

## UC-12 — Consultar historial de respaldos
**Actor:** SOCIO.
**Flujo principal:** abre la pantalla de respaldos → ve cada backup con fecha, tipo y estado. *(RF-22, RN-13)*
