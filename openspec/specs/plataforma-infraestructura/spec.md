# Spec: Plataforma e Infraestructura

### Requirement: Esqueleto del monorepo feature-first

El repositorio SHALL contener el armazón mínimo de los servicios siguiendo la organización feature-first / vertical slice (ADR-0009), sin implementar ninguna feature de negocio.

#### Scenario: Estructura del backend presente

- **WHEN** se inspecciona el directorio `backend/`
- **THEN** existen `backend/app/main.py`, `backend/app/core/` (configuración transversal) y los directorios `backend/app/shared/` y `backend/app/features/` como placeholders
- **AND** no existen carpetas globales `services/`, `models/` ni `schemas/` en la raíz de `app/`

#### Scenario: Directorio de workflows de n8n presente

- **WHEN** se inspecciona el repositorio
- **THEN** existe `n8n/workflows/` para alojar los workflows JSON (WF-01/02/05) que se agregarán en changes posteriores

### Requirement: Orquestación con docker-compose de los cuatro servicios

El repositorio SHALL incluir un `docker-compose.yml` que defina y levante los cuatro servicios: `frontend` (React/Vite), `backend` (FastAPI/Uvicorn), `db` (PostgreSQL) y `n8n`.

#### Scenario: docker compose up levanta los cuatro servicios

- **WHEN** se ejecuta `docker compose up --build` desde la raíz del repositorio
- **THEN** los cuatro servicios `frontend`, `backend`, `db` y `n8n` arrancan y quedan en estado saludable
- **AND** el criterio de aceptación de RNF-07 ("el sistema levanta con `docker compose up`") queda satisfecho

#### Scenario: Backend espera a que la base de datos esté lista

- **WHEN** se levanta el stack
- **THEN** el servicio `backend` declara dependencia del servicio `db` (`depends_on`) para no fallar por arranque prematuro

### Requirement: Redes privadas y exposición mínima de puertos

El stack SHALL usar redes privadas entre contenedores y exponer al host únicamente los servicios necesarios; `db` y `n8n` no se exponen públicamente.

#### Scenario: Solo frontend y backend se exponen al host

- **WHEN** se inspecciona el mapeo de puertos del `docker-compose.yml`
- **THEN** `frontend` (`:3000`) y `backend` (`:8000`, para API/Swagger en desarrollo) publican puertos al host
- **AND** `db` y `n8n` quedan accesibles solo dentro de la red privada del compose (sin publicar puerto, salvo el `:5678` de n8n para uso local de desarrollo si se decide explícitamente)

#### Scenario: Comunicación interna por nombre de servicio

- **WHEN** el backend necesita conectarse a la base de datos
- **THEN** lo hace por el hostname del servicio (`db`) dentro de la red privada, no por `localhost`

### Requirement: Persistencia mediante volúmenes nombrados

El stack SHALL persistir los datos de PostgreSQL y de n8n en volúmenes nombrados de Docker.

#### Scenario: Los datos sobreviven a un reinicio del contenedor

- **WHEN** se detiene y se vuelve a levantar el servicio `db` (sin `down -v`)
- **THEN** los datos previos siguen disponibles porque residen en un volumen nombrado
- **AND** n8n conserva sus credenciales y workflows en su propio volumen nombrado

### Requirement: Configuración por variables de entorno sin secretos en el repo

La configuración SHALL externalizarse en variables de entorno; el repositorio NO SHALL contener secretos ni archivos `.env` con valores reales.

#### Scenario: Plantilla de entorno provista

- **WHEN** se inspecciona el repositorio
- **THEN** existe un `.env.example` con las claves necesarias (al menos `DATABASE_URL`, `DB_USER`, `DB_PASSWORD`, `LOG_LEVEL`) y valores de ejemplo o vacíos, alineado con §1 de `07-seguridad-y-despliegue/`

#### Scenario: El archivo .env real está ignorado por git

- **WHEN** se inspecciona el `.gitignore`
- **THEN** `.env` está ignorado y no se versiona ningún secreto real

### Requirement: Endpoint de health check del backend

El backend SHALL exponer `GET /health` que devuelve el estado del servicio, sin requerir autenticación (RNF-13).

#### Scenario: Health check responde UP

- **WHEN** se hace `GET /health` al backend
- **THEN** responde `200 OK` con cuerpo `{"status":"UP"}`
- **AND** no requiere cookie de sesión ni token

#### Scenario: Health check verificable tras docker compose up

- **WHEN** el stack está levantado y se ejecuta `curl http://localhost:8000/health`
- **THEN** la respuesta es `{"status":"UP"}`, confirmando que el smoke test de la plataforma pasa
