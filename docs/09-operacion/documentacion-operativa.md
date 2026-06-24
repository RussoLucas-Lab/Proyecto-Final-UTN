# Documentación Técnica y Operativa

## Requisitos previos
- Docker y Docker Compose.
- Acceso a credenciales de: base de datos, servicio de IA y almacenamiento externo (para n8n).

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL. |
| `JWT_SECRET` | Secreto para firmar tokens. |
| `N8N_WEBHOOK_URL` | URL base de los webhooks de n8n. |
| `IA_API_KEY` | Credencial del proveedor del modelo de lenguaje. |
| `STORAGE_*` | Credenciales del almacenamiento de documentos en Cloudflare R2 (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`). API S3-compatible (ADR-0007). |
| `SMTP_*` | Configuración de correo para notificaciones. |

> Nunca commitear secretos. Usar `.env` (ignorado) y, en producción, un gestor de secretos.

## Puesta en marcha (desarrollo)

```bash
git clone <repo> && cd iuris
cp .env.example .env   # completar valores
docker compose up --build
```
- Frontend: `http://localhost:3000`
- API + OpenAPI: `http://localhost:8000/docs`
- n8n: `http://localhost:5678`

## Carga de datos / seeds
1. Cargar el ciclo de vida: `psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql` (o `python backend/seeds/etapas_seed_data.py`). Crea las etapas y transiciones de Laboral y ART.
2. Cargar datos sintéticos (clientes/casos ficticios) para pruebas o demos (ADR-0004).

## Flujos de n8n
1. Importar los workflows (`/n8n/workflows/*.json`) desde la UI de n8n.
2. Configurar credenciales (IA, almacenamiento, SMTP).
3. Activar: **WF-01 Generar actualización** (webhook), **WF-02 Backup automático** (cron) y **WF-05 Batch de actualizaciones** (cron diario).

## Respaldo y restauración

**Respaldo:** automático diario vía n8n (RN-11); manual desde `POST /backups`.
**Restauración (procedimiento):**
```bash
# 1. Detener servicios que escriben en la DB
# 2. Restaurar el dump
psql "$DATABASE_URL" < backup_YYYYMMDD.sql
# 3. Verificar integridad y reanudar servicios
```

## Runbook — problemas frecuentes

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| "Generar actualización" falla | n8n caído o `IA_API_KEY` inválida | Revisar n8n y la credencial; el sistema permite redacción manual. |
| Backup en estado ERROR | Sin acceso al almacenamiento | Verificar credenciales `STORAGE_*` y reintentar manual. |
| 401 en la API | Token vencido | Reautenticar (`/auth/login`). |
| 409 al crear cliente | DNI duplicado (RN-03) | Buscar el cliente existente. |

## Monitoreo
- Logs del backend y de n8n.
- Verificación diaria del historial de backups (RF-22).
