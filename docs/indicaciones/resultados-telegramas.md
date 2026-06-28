# Dropdown de Resultado de Telegrama — Pantalla de Caso

## Contexto

El flujo de etapas/transiciones para los Telegramas 1, 2 y 3 **ya está
implementado correctamente** en el código (ADR-0008, `etapa`/`transicion_etapa`).
No hay que tocar esa lógica.

Lo único que falta es agregar un **dropdown** en la pantalla del caso para
que el usuario pueda registrar el **resultado** del telegrama enviado.

## Comportamiento esperado

- El dropdown **solo guarda/selecciona** el valor elegido. No dispara
  ninguna transición de etapa por sí solo.
- La transición de etapa sigue disparándose **exclusivamente** con el botón
  ya implementado (el que ya existe en la pantalla de caso para avanzar de
  etapa). El dropdown es un dato previo/independiente a esa acción.
- El mismo dropdown (mismas 5 opciones) se reutiliza para Telegrama 1, 2 y 3
  — no se define una lista distinta por cada uno.

## Opciones del dropdown (las 5, confirmadas)

- ENTREGADO
- RECHAZADO
- EN SUCURSAL
- DOMICILIO INEXISTENTE
- DOMICILIO CERRADO

## Alcance del cambio

- Es un cambio de **UI únicamente** (más el campo en el modelo de datos para
  persistir el valor elegido, si todavía no existe un lugar donde guardarlo).
- No modifica `etapa`, `transicion_etapa` ni la lógica de transición ya
  implementada.
- No modifica el generador de telegramas (HTML + pdf-lib).

## Preguntas abiertas (mínimas, antes de implementar)

1. **¿Dónde se persiste el valor elegido?** ¿Ya existe un campo en el modelo
   de caso/telegrama para esto, o hay que agregarlo (columna nueva + migración
   Alembic)?

   RESPUESTA: elijelo tu claude
2. **¿El botón de transición depende del valor del dropdown?** Aunque no lo
   dispare automáticamente, ¿el botón debería estar deshabilitado hasta que
   se elija un resultado, o son completamente independientes?

   RESPUESTA: el botón debería estar deshabilitado hasta que se elija un resultado.

3. **¿Es editable después de elegido?** ¿Se puede cambiar el resultado una vez
   seleccionado, o queda fijo tras guardarse?

   RESPUESTA: si es editable

## Sugerencia de implementación

1. Definir la lista de 5 opciones como constante compartida (frontend),
   reutilizada en los 3 lugares donde se muestra el telegrama correspondiente.
2. Si falta el campo en el modelo de datos: agregar columna con
   `CHECK constraint` (los 5 valores fijos) en la tabla correspondiente del
   caso/telegrama, vía Alembic.
3. Endpoint simple (PATCH) para guardar el valor seleccionado, separado del
   endpoint que dispara la transición de etapa (ya existente).
4. No se necesita tocar el skill `etapas-y-transiciones` — esto no es una
   etapa nueva, es un dato auxiliar.

## Próximo paso sugerido

- Responder las 3 preguntas abiertas.
- Generar el prompt de Claude Code con: este archivo + componente/pantalla
  exacta donde va el dropdown + nombre del campo a persistir.
