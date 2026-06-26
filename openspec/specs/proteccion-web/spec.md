## ADDED Requirements

### Requirement: Protección CSRF double-submit en mutaciones

Dado que la sesión viaja en cookies, el sistema SHALL implementar protección CSRF mediante el patrón double-submit cookie. En el login (y cuando no exista), el backend SHALL emitir una cookie `csrf_token` legible por JavaScript (NO `HttpOnly`). Toda petición mutante (`POST`, `PUT`, `PATCH`, `DELETE`) a un endpoint protegido SHALL incluir el header `X-CSRF-Token` con un valor que coincida con la cookie `csrf_token`. Si el header falta o no coincide con la cookie, el sistema SHALL responder 403 y registrar el evento CSRF en el log de seguridad. Los métodos seguros (`GET`, `HEAD`, `OPTIONS`) SHALL quedar exentos de esta validación. (RNF-11)

#### Scenario: Mutación con CSRF válido
- **WHEN** se envía un `POST/PUT/PATCH/DELETE` con el header `X-CSRF-Token` igual a la cookie `csrf_token`
- **THEN** el sistema procesa la petición normalmente

#### Scenario: Mutación sin header CSRF
- **WHEN** se envía una mutación sin el header `X-CSRF-Token`
- **THEN** el sistema responde 403 y no ejecuta la operación

#### Scenario: Header CSRF que no coincide con la cookie
- **WHEN** se envía una mutación con un `X-CSRF-Token` distinto del valor de la cookie `csrf_token`
- **THEN** el sistema responde 403 y registra el evento en el log de seguridad

#### Scenario: Método seguro exento
- **WHEN** se envía un `GET` a un endpoint
- **THEN** el sistema no exige el header CSRF

#### Scenario: La cookie CSRF es legible por JS
- **WHEN** el backend emite la cookie `csrf_token`
- **THEN** la cookie NO tiene la bandera `HttpOnly`, de modo que el frontend pueda leerla y reenviarla

### Requirement: Rate limiting de login

El sistema SHALL limitar los intentos de `POST /auth/login` a aproximadamente 5 por minuto por origen, configurable vía entorno. Al superar el umbral, el sistema SHALL responder 429 sin procesar las credenciales y registrar el exceso de intentos en el log de seguridad. (RNF-11)

#### Scenario: Exceso de intentos de login
- **WHEN** un mismo origen supera ~5 intentos de login en un minuto
- **THEN** el sistema responde 429 a los intentos adicionales
- **AND** registra el exceso en el log de seguridad sin incluir las contraseñas probadas

### Requirement: Headers de seguridad en todas las respuestas

El sistema SHALL incluir en todas las respuestas HTTP los headers de seguridad: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin`, `Content-Security-Policy` y `Strict-Transport-Security`. (RNF-11)

#### Scenario: Headers presentes
- **WHEN** el backend responde a cualquier petición
- **THEN** la respuesta incluye `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy` y `Strict-Transport-Security`

### Requirement: No exponer detalles internos ni datos sensibles

El sistema SHALL responder los errores internos con un cuerpo genérico (`{"error": "Internal Server Error"}`) sin filtrar trazas ni detalles, dejando el detalle solo en los logs. El sistema NUNCA SHALL registrar contraseñas, tokens ni datos personales sensibles en los logs. (RNF-11, RNF-13)

#### Scenario: Error interno no expone detalle
- **WHEN** ocurre una excepción no controlada en el backend
- **THEN** la respuesta al cliente es genérica, sin stacktrace ni detalle interno
- **AND** el detalle queda únicamente en los logs del servidor

#### Scenario: Los logs no contienen secretos
- **WHEN** se registran eventos de login, logout o errores de autenticación
- **THEN** los registros no incluyen contraseñas, tokens ni datos personales sensibles
