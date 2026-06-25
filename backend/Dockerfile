FROM python:3.12-slim

WORKDIR /backend

# Instala dependencias primero para aprovechar la caché de capas
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia el código fuente y los artefactos de migración
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 8000

# entrypoint.sh corre "alembic upgrade head" antes de arrancar Uvicorn.
# El orden de arranque (db healthy → backend) está garantizado por
# depends_on: condition: service_healthy en docker-compose.yml.
ENTRYPOINT ["./entrypoint.sh"]
