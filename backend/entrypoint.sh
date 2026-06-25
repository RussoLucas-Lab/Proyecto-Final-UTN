#!/bin/sh
# entrypoint.sh — Iuris backend
#
# Ejecuta las migraciones de Alembic antes de iniciar Uvicorn.
# El servicio 'db' ya está saludable gracias a depends_on: condition: service_healthy
# en docker-compose.yml.
#
# En local: no se usa este script directamente; se corre
#   cd backend && alembic upgrade head
# antes de levantar el servidor (ver backend/CLAUDE.md).

set -e

echo "[entrypoint] Applying Alembic migrations..."
alembic upgrade head

echo "[entrypoint] Starting Uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
