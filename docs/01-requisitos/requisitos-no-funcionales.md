# Requisitos No Funcionales (RNF)

Detalle completo de seguridad y despliegue en `07-seguridad-y-despliegue/`.

| ID | Categoría | Requisito | Criterio de aceptación |
|----|-----------|-----------|------------------------|
| RNF-01 | Confidencialidad | Acceso restringido por autenticación y rol (RBAC). | Ningún recurso protegido es accesible sin sesión válida. |
| RNF-02 | Protección de datos | Tratamiento conforme a la Ley 25.326. | Datos cifrados en tránsito (HTTPS) y en reposo; contraseñas con hash (bcrypt/argon2). |
| RNF-03 | Trazabilidad / Auditoría | Operaciones relevantes registradas. | Cambios de etapa y backups quedan en el historial con marca temporal. |
| RNF-04 | IA controlada | La IA opera siempre con humano en el bucle. | No existe flujo que envíe comunicaciones sin aprobación humana. |
| RNF-05 | Usabilidad | Curva de aprendizaje mínima; lenguaje simple (público vulnerable). | Un abogado completa el alta de un caso sin capacitación formal. |
| RNF-06 | Rendimiento | Respuesta ágil. | Tiempo promedio de respuesta < 500 ms. |
| RNF-07 | Portabilidad | Despliegue reproducible y storage S3-estándar. | El sistema levanta con `docker compose up`; el storage puede migrarse por configuración. |
| RNF-08 | Disponibilidad | Respaldo periódico y objetivo de uptime. | Backup automático diario; disponibilidad objetivo 99%. |
| RNF-09 | Mantenibilidad | Código y specs alineados y versionados; migraciones. | Cambios de esquema vía Alembic; cada cambio funcional referencia su RF/RN. |
| RNF-10 | Privacidad en pruebas | Pruebas y demos sin datos reales. | Entorno de prueba con base de datos sintética. |
| RNF-11 | Seguridad web | Protección frente a OWASP Top 10. | JWT + refresh revocables, cookies HttpOnly/Secure/SameSite, CSRF, XSS, SQLi (consultas parametrizadas), rate limiting, headers de seguridad. |
| RNF-12 | Escalabilidad | Backend **stateless**. | La sesión no vive en memoria del backend; el estado se externaliza. |
| RNF-13 | Observabilidad | Salud y trazas. | Endpoint `GET /health`; logs de aplicación y de seguridad (sin datos sensibles). |
| RNF-14 | Calidad | Pruebas automatizadas. | Cobertura objetivo ≥ 80% en servicios, validadores y reglas de negocio. |
