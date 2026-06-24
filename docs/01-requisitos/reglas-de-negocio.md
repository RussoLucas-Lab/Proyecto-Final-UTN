# Reglas de Negocio (RN)

## Casos, etapas y acceso

| ID | Regla |
|----|-------|
| RN-01 | Un caso pertenece a **un** cliente y tiene **un** abogado responsable. |
| RN-02 | Un documento siempre está asociado a **un** caso; no hay documentos huérfanos. |
| RN-03 | El DNI de un cliente es único en el estudio. |
| RN-04 | La etapa de un caso solo cambia siguiendo transiciones válidas de su **área** (ver `transicion_etapa`). |
| RN-05 | Todo cambio de etapa genera una entrada en el historial del caso. |
| RN-06 | El historial del caso es **inmutable**: no se edita ni se elimina. |
| RN-07 | Solo el rol **SOCIO** puede crear, editar o desactivar usuarios. |
| RN-08 | Todo usuario autenticado puede **leer** los casos del estudio; la titularidad no limita la lectura. La segmentación es por área (relevante al sumar Tránsito a futuro). |
| RN-09 | Un caso en etapa **terminal** (Acuerdo / Indemnización / Sentencia) está cerrado; el retroceso solo procede con confirmación explícita. |
| RN-10 | **Ninguna comunicación se envía automáticamente.** La IA genera borradores; el abogado revisa, edita y aprueba. La responsabilidad es siempre del profesional. |
| RN-11 | El área de un caso determina su ciclo de vida; las etapas de un área no aplican a otra. |
| RN-12 | El **cliente nunca sube documentos**; lo hace el abogado. |
| RN-13 | Los respaldos automáticos se ejecutan al menos una vez al día y quedan registrados (fecha, tipo, estado). |
| RN-14 | Los datos personales se usan solo para la gestión del caso (finalidad, Ley 25.326). |

## Telegramas (Ley 23.789)

| ID | Regla |
|----|-------|
| RN-15 | El generador de telegramas solo aplica a casos del área **Laboral**. |
| RN-16 | Un caso admite hasta **3 telegramas** (número 1, 2 o 3). |
| RN-17 | El abogado revisa y confirma los datos prellenados antes de generar el PDF. |
| RN-18 | Al guardar, el PDF se asocia al caso como documento y se registra el telegrama (resultado inicial `PENDIENTE`). |

## Batch de actualizaciones (WF-05)

| ID | Regla |
|----|-------|
| RN-19 | El batch nunca envía; solo genera borradores `PENDIENTE_REVISION` (deriva de RN-10). |
| RN-20 | Solo se generan actualizaciones para casos **activos** (etapa no terminal). |
| RN-21 | Cadencia de 15 días desde la última actualización aprobada (o desde `fecha_inicio`). |
| RN-22 | Idempotencia: no más de un borrador automático pendiente por caso y ventana. |
| RN-23 | El contenido no menciona plazos ni montos; lenguaje simple. |
