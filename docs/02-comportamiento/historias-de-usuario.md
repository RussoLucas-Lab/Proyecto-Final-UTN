# Historias de Usuario (US)

Formato: *Como <rol> quiero <objetivo> para <beneficio>*, con criterios en estilo Gherkin.

## Épica: Gestión de casos

### US-01 — Centralizar la información del caso
> Como **abogado**, quiero ver toda la información de un caso en una sola pantalla, para dejar de cruzar varios Excel.

- **Dado** un caso, **cuando** lo abro, **entonces** veo cliente, etapa actual, ficha, documentos, historial y vencimientos.
- **Dado** un avance de etapa, **cuando** lo guardo, **entonces** se registra en el historial. *(RF-12, RN-05)*

### US-02 — Avanzar el caso por su flujo real
> Como **abogado**, quiero avanzar el caso por las etapas de su área, para reflejar el estado real del expediente.

- **Dado** un caso Laboral en "Telegrama 1", **cuando** avanzo, **entonces** solo puedo ir a las etapas permitidas (Telegrama 2 o Conciliación).
- **Cuando** avanzo por error, **entonces** puedo **retroceder con confirmación**. *(RF-10, RF-11, RN-04, RN-09)*

## Épica: Gestión documental

### US-03 — Subir documentos arrastrando
> Como **abogado**, quiero arrastrar archivos al caso, para adjuntarlos sin formularios complejos.

- **Dado** un caso abierto, **cuando** arrastro un PDF/Word/imagen, **entonces** queda asociado al caso (en R2).
- **Entonces** el cliente **no** puede subir documentos. *(RF-14, RN-02, RN-12)*

## Épica: Comunicación con clientes

### US-04 — Generar una actualización con IA
> Como **abogado**, quiero un borrador de actualización con un clic, para comunicarme más rápido sin perder el control.

- **Dado** un caso, **cuando** pido la actualización, **entonces** obtengo un borrador editable.
- **Entonces** nada se envía hasta que yo lo apruebe. *(RF-16, RF-18, RN-10)*

### US-05 — Encontrar los mensajes ya listos (batch)
> Como **abogado**, quiero que al abrir la app estén los mensajes de los clientes que toca actualizar, para no redactarlos uno por uno.

- **Dado** que un caso cumple 15 días, **cuando** abro el dashboard, **entonces** veo su borrador listo para revisar. *(RF-26, RN-19..23)*

## Épica: Telegramas

### US-06 — Generar el telegrama prellenado
> Como **abogado**, quiero generar el telegrama Ley 23.789 con los datos del caso, para no cargarlos a mano en Canva.

- **Dado** un caso Laboral, **cuando** genero un telegrama, **entonces** el formulario aparece prellenado y editable, y puedo descargar el PDF. *(RF-25, RN-15..18)*

## Épica: Agenda y respaldos

### US-07 — Ver qué hay que hacer cada día
> Como **abogado**, quiero un calendario con los movimientos a realizar, para no perder un plazo.

- **Cuando** abro la agenda, **entonces** veo las fechas y tareas de todo el estudio. *(RF-20)*

### US-08 — Confiar en que la información está respaldada
> Como **socio**, quiero ver el historial de respaldos, para tener certeza de que la información está protegida.

- **Dado** que corren backups diarios, **cuando** abro la pantalla de respaldos, **entonces** veo fecha, tipo y estado. *(RF-22, RN-13)*
