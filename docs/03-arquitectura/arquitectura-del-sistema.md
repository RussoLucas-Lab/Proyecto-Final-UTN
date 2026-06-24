# Arquitectura del Sistema

## Visión general

Iuris es una aplicación web de tres capas, complementada por un motor de orquestación de procesos (n8n) que atiende las tareas asíncronas y programadas.

| Capa | Tecnología | Responsabilidad |
|------|-----------|-----------------|
| Presentación | React | Interfaz de gestión para usuarios profesionales. |
| Aplicación / API | FastAPI | Lógica de negocio y exposición de la API REST. |
| Persistencia | PostgreSQL | Fuente única de verdad (modelo relacional normalizado). |
| Almacenamiento de documentos | Cloudflare R2 (S3-compatible) | Archivos del caso; bucket privado, acceso por URLs prefirmadas (ADR-0007). |
| Orquestación | n8n | Comunicaciones asistidas (WF-01/05), respaldos (WF-02). |
| IA | Nodo AI Agent (en n8n) + OpenAI Chat Model | Generación de borradores de comunicación. **El backend no integra IA.** |
| Empaquetado | Docker / Docker Compose | Despliegue reproducible. Seguridad y despliegue en `07-seguridad-y-despliegue/`. |

## Principios

- **Fuente única de verdad:** ningún dato vive en archivos sueltos; todo en PostgreSQL.
- **Separación sincrónico/asíncrono:** la API atiende lo interactivo; n8n, lo programado y los procesos largos.
- **Humano en el bucle:** la IA propone, el abogado dispone (RN-10).
- **IA confinada a n8n:** toda la IA se implementa con nodos de agente de n8n; el backend no contiene lógica de IA.
- **Confidencialidad por diseño:** control de acceso por rol, auditoría y datos sintéticos en pruebas.

## Flujo: generación de actualización (asíncrono)

1. El frontend invoca `POST /casos/{id}/actualizacion`.
2. El backend (tras validar sesión y rol) dispara un webhook de n8n con el `caso_id`.
3. El nodo **AI Agent** de n8n genera el borrador; obtiene el contexto del caso mediante una herramienta que consulta un endpoint **de solo lectura** del backend.
4. El backend retorna el borrador al frontend para revisión humana.

Ver secuencia detallada en `diagramas.md`.

## Flujo: respaldo automático (programado)

`Cron (n8n)` → consulta PostgreSQL → genera Excel → guarda en almacenamiento externo → registra en historial de backups → notifica por email.

## Despliegue

Todos los servicios (frontend, backend, base de datos, n8n) se orquestan con Docker Compose. Las variables sensibles se gestionan por variables de entorno (ver `09-operacion/`).
