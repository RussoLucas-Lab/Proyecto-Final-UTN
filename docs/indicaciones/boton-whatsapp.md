# Botón "Chatear por WhatsApp" — Ventana de Caso

## Objetivo

Agregar en la ventana de caso un botón con los colores y el logo de WhatsApp
que, al hacer clic, abra un chat de WhatsApp con el **celular del cliente
registrado** en ese caso.

## Cómo funciona (click-to-chat / wa.me)

WhatsApp expone un formato oficial de link llamado *click-to-chat* que abre
una conversación con un número sin necesidad de tenerlo agendado:

```
https://wa.me/<numero>
```

- `<numero>` va en **formato internacional, solo dígitos**.
- **Sin** signo `+`, sin espacios, sin guiones, sin paréntesis, sin ceros
  iniciales del prefijo de área.
- Funciona en móvil (abre la app) y en desktop (abre WhatsApp Web).
- No requiere WhatsApp Business ni API. Es un simple `<a href>`.

### ⚠️ Punto crítico: normalización del número argentino

Este es el detalle que más fácilmente rompe el link. Los celulares
registrados en la base probablemente NO están en el formato que `wa.me`
necesita. Hay que normalizarlos antes de construir la URL.

Para Argentina:
- Código de país: `54`
- Celulares requieren un `9` después del código de país (formato
  internacional de móviles argentinos): `54 9 <area> <numero>`
- Quitar el `0` inicial del prefijo de área si está presente.
- Quitar el `15` que a veces se antepone al número local de celular.

Ejemplos de normalización (formato local → wa.me):

| Cómo puede estar guardado        | Normalizado para wa.me   |
|----------------------------------|--------------------------|
| `0261 15 1234567`                | `5492611234567`          |
| `261 1234567`                    | `5492611234567`          |
| `+54 9 261 123-4567`             | `5492611234567`          |
| `15 1234567` (sin área)          | ⚠️ falta el área — ver abajo |

**Recomendación de implementación**: escribir una función de normalización
que reciba el celular crudo y devuelva solo dígitos en formato wa.me. Pasos:

1. Eliminar todo lo que no sea dígito (`+`, espacios, `-`, `(`, `)`).
2. Si empieza con `54`, asumir que ya tiene código de país; si no, anteponerlo.
3. Manejar el `9` de celular y el `15`/`0` locales según el formato detectado.
4. Validar que el resultado tenga una longitud razonable (un celular AR
   normalizado ronda los 13 dígitos: `54` + `9` + 10 dígitos).

⚠️ **Pregunta abierta para Lucas**: ¿en qué formato exacto se guardan hoy los
celulares de cliente en la base? (¿Hay validación/máscara en el alta de
cliente, o entran como texto libre?). De esto depende cuán robusta debe ser
la normalización. Lo ideal sería normalizar/validar el celular en el **alta
del cliente** y guardar ya el formato canónico, de modo que el botón solo
tenga que anteponer `https://wa.me/`. Confirmar antes de implementar.

## Mensaje pre-cargado (opcional)

Se puede pre-cargar un texto en el chat con `?text=` (URL-encoded). Ej:

```
https://wa.me/5492611234567?text=Hola%2C%20le%20escribo%20del%20estudio...
```

El usuario puede editarlo antes de enviar. **A confirmar con Lucas**: ¿quieren
un mensaje pre-cargado (ej. saludo del estudio + referencia al caso), o el
botón abre el chat vacío? Si lo quieren, definir el texto exacto.

## Marca y estilo del botón

WhatsApp tiene guías de marca para el botón oficial "Chat on WhatsApp", pero
ese botón oficial solo está disponible en inglés y en verde/blanco fijos. Como
acá la UI está en español y dentro de una pantalla propia, lo razonable es un
botón propio que **respete los colores y el logo** de WhatsApp sin copiar el
asset oficial en inglés:

- **Verde de marca WhatsApp**: `#25D366` (verde principal / brand).
  Alternativo más oscuro para hover o el verde "teal" del header: `#075E54`
  / `#128C7E`.
- **Logo**: usar el ícono oficial de WhatsApp (glifo del teléfono dentro del
  globo de chat). Preferir un SVG del logo para que escale nítido.
  ⚠️ **Nota de IP/licencia**: el logo de WhatsApp es marca registrada de Meta.
  Para uso interno en una herramienta de gestión del estudio es de bajo riesgo,
  pero conviene usar el ícono tal cual (sin alterar colores ni proporciones)
  y, si en algún momento el producto se distribuye, revisar las brand
  guidelines de WhatsApp/Meta. Para el TFG no debería ser un problema.
- **Texto sugerido**: "Chatear por WhatsApp" o solo el ícono + tooltip.
- Mantener contraste y tamaño accesibles (texto legible, área de clic cómoda).

Una opción limpia y sin problemas de assets es usar el ícono de WhatsApp de
una librería de íconos ya presente en el proyecto (ej. `lucide-react` no trae
logos de marca, pero `react-icons` tiene `FaWhatsapp`). Confirmar qué librería
de íconos usa el frontend para no agregar una dependencia nueva solo por esto.

## Comportamiento del botón

- El botón abre el link en una pestaña/contexto nuevo: `target="_blank"` con
  `rel="noopener noreferrer"`.
- Si el cliente **no tiene celular registrado** (campo nulo/vacío), el botón
  debe estar **deshabilitado** o no renderizarse, para no generar un link roto.
- Si el número no se puede normalizar a un formato válido, mismo criterio:
  deshabilitar + (opcional) tooltip explicando que el celular no es válido.

## Alcance del cambio

- Es un cambio de **frontend / UI**. No requiere backend nuevo si el celular
  del cliente ya viene en el modelo del caso.
- No se envían datos a ningún servidor de WhatsApp desde el sistema: es solo
  un link que el navegador abre. (Bueno desde el punto de vista de privacidad
  — coherente con cómo ya se maneja el generador de telegramas client-side.)

## Preguntas abiertas (confirmar antes de implementar)

1. **Formato de guardado del celular** del cliente en la base (texto libre vs.
   validado/canónico). Define la robustez de la normalización.
2. **Mensaje pre-cargado**: ¿sí o no? Si sí, ¿qué texto?

  Para la página de caso, sin mensaje precargado, pero para la parte de generar mensajes con IA y n8n podemos implementar el botón con el mensaje ya cargado luego de que el usuario verifique su contenido, pero esto veamóslo en su change correspondiente.

3. **Librería de íconos** ya presente en el frontend, para el logo.
4. **De dónde sale el celular** en la pantalla de caso: ¿está en el objeto
   cliente asociado al caso, o hay que traerlo de otro endpoint?

## Próximo paso sugerido

- Responder las 4 preguntas (sobre todo la #1).
- Generar el prompt de Claude Code con: este archivo + el componente exacto de
  la ventana de caso donde va el botón + el campo/path del celular del cliente.
