---

# Arquitectura de Envío de Correos

Con el objetivo de desacoplar la lógica de negocio del envío de correos electrónicos, la aplicación utilizará **n8n** como plataforma de automatización y **Resend** como proveedor de correo electrónico.

Este enfoque evita que el backend tenga que conectarse directamente a un servidor SMTP o implementar lógica específica para el envío de emails, delegando toda esa responsabilidad a un servicio especializado.

## Objetivos

- Desacoplar el envío de correos del backend.
- Centralizar todas las notificaciones en un único servicio.
- Facilitar el mantenimiento y la escalabilidad.
- Permitir reutilizar la infraestructura para futuros tipos de notificaciones.
- Reducir la complejidad del código de la aplicación.

---

# Arquitectura

```text
React Frontend
        │
        ▼
Backend Pyhton
        │
        │ POST /api/invitations
        ▼
Generación de usuario + token
        │
        ▼
Webhook HTTP
        │
        ▼
n8n
        │
        ├── Construcción del email
        ├── Aplicación de plantilla HTML
        └── Envío mediante Resend
                │
                ▼
Servidor de correo
                │
                ▼
Usuario
```

En esta arquitectura, el backend únicamente se encarga de generar la invitación y solicitar el envío del correo.

Toda la lógica relacionada con el diseño del email, el proveedor de envío y futuras automatizaciones queda encapsulada dentro de **n8n**.

---

# Flujo de Envío

Una vez creada la invitación:

1. El backend genera el usuario en estado **INVITED**.
2. Se genera un token seguro.
3. Se almacena el hash del token.
4. Se construye el enlace de activación.
5. El backend realiza una petición HTTP al webhook de n8n.
6. n8n recibe la información.
7. n8n genera el correo HTML.
8. Resend envía el correo al destinatario.

---

# Comunicación entre Backend y n8n

El backend enviará una petición HTTP al webhook correspondiente.

Ejemplo:

```
POST

/webhook/email/invitation
```

Payload:

```json
{
    "email": "usuario@empresa.com",
    "name": "Juan Pérez",
    "role": "ABOGADO",
    "activationLink": "https://active-trace.com/activate?token=xxxxxxxx"
}
```

La responsabilidad del backend finaliza una vez enviada correctamente esta solicitud.

---

# Workflow de n8n

El workflow encargado del envío de invitaciones tendrá una estructura sencilla y desacoplada.

```text
Webhook
      │
      ▼
Validación de datos
      │
      ▼
Preparación de variables
      │
      ▼
Construcción de plantilla HTML
      │
      ▼
Nodo Resend
      │
      ▼
Respuesta HTTP 200
```

Cada nodo tendrá una única responsabilidad:

| Nodo | Función |
|-------|----------|
| Webhook | Recibir la solicitud proveniente del backend. |
| Validación | Verificar que todos los datos requeridos estén presentes. |
| Variables | Preparar los datos que utilizará la plantilla. |
| HTML | Construir el correo electrónico. |
| Resend | Enviar el correo al destinatario. |

---

# Uso de Resend

Como proveedor de correo electrónico se utilizará **Resend**, debido a que ofrece una API moderna, una excelente entregabilidad y una integración sencilla con n8n.

## Ventajas

- API moderna y bien documentada.
- Excelente tasa de entrega de correos.
- Integración sencilla con n8n.
- Configuración rápida.
- Plan gratuito suficiente para entornos de desarrollo y proyectos pequeños.
- Permite utilizar plantillas HTML de manera simple.

## Consideraciones

Para aprovechar completamente las capacidades de Resend es recomendable utilizar un dominio propio previamente verificado.

Esto mejora considerablemente la reputación del remitente y reduce la probabilidad de que los correos sean clasificados como spam.

---

# Separación de Responsabilidades

La solución queda distribuida de la siguiente manera:

| Componente | Responsabilidad |
|------------|-----------------|
| React | Interfaz de usuario. |
| Backend Java | Reglas de negocio, autenticación, generación de invitaciones y tokens. |
| n8n | Automatización y orquestación de correos electrónicos. |
| Resend | Entrega efectiva de los mensajes. |

Esta separación favorece una arquitectura modular, desacoplada y fácil de mantener.

---

# Escalabilidad

Una de las principales ventajas de incorporar n8n es que la infraestructura podrá reutilizarse para cualquier otro flujo de notificaciones sin modificar el backend.

En el futuro podrán implementarse workflows independientes para:

- Recuperación de contraseña.
- Restablecimiento de credenciales.
- Bienvenida a nuevos usuarios.
- Cambio de contraseña.
- Confirmación de cambios de correo electrónico.
- Avisos de bloqueo o desbloqueo de cuentas.
- Notificaciones administrativas.
- Recordatorios automáticos.

Cada uno de estos procesos podrá implementarse como un workflow independiente dentro de n8n, reutilizando la misma infraestructura de comunicación mediante webhooks.

---

# Beneficios de la Arquitectura

La incorporación de n8n junto con Resend proporciona las siguientes ventajas:

- Bajo acoplamiento entre componentes.
- Mayor mantenibilidad.
- Fácil sustitución del proveedor de correo.
- Escalabilidad para futuros procesos automáticos.
- Menor complejidad en el backend.
- Centralización de todas las automatizaciones de correo en un único servicio.
- Arquitectura alineada con principios de separación de responsabilidades y diseño modular.

Como resultado, el backend permanece enfocado exclusivamente en las reglas de negocio de la aplicación, mientras que toda la gestión relacionada con comunicaciones y automatizaciones queda delegada a una plataforma especializada.
 
IMPORTANTE SEGURIDAD:

 Tokens de 256 bits generados con SecureRandom.
 Expiración (24–72 horas).
 Un solo uso.
 Guardar solo el hash del token.
 Invalidar todas las invitaciones anteriores al reenviar una nueva para el mismo email (opcional pero recomendable).
 Rate limiting en el endpoint de validación para evitar fuerza bruta.
 Siempre responder con un mensaje genérico ("Si la invitación es válida...") para no filtrar información sobre correos existentes.
 Cookies HttpOnly, Secure y SameSite=Lax o Strict para la sesión, si usás autenticación basada en cookies.

---

RN-INV-001 – Unicidad de Invitación Activa

Un usuario podrá tener como máximo una invitación activa en un momento determinado. Si un administrador genera una nueva invitación para un usuario con una invitación activa, el sistema invalidará automáticamente la invitación anterior, generará un nuevo token de activación y enviará un nuevo correo electrónico.

Y complementaría con otra regla:

RN-INV-002 – Usuarios Activos

No se permitirá generar invitaciones para usuarios cuyo estado sea ACTIVE. En su lugar, el administrador deberá gestionar la cuenta existente o indicar al usuario que utilice el mecanismo de recuperación de contraseña si perdió sus credenciales (ver ventana recuperacion contraseña).