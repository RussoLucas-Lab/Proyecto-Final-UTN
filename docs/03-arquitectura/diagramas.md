# Diagramas

Diagramas en Mermaid (se renderizan en GitHub/GitLab/VSCode).

## Componentes / despliegue

```mermaid
flowchart TB
    subgraph Cliente
      B[Navegador]
    end
    subgraph App["Aplicación (Docker)"]
      FE[Frontend - React]
      BE[Backend - FastAPI]
      N8N[n8n - Orquestación]
    end
    DB[(PostgreSQL)]
    R2[(Cloudflare R2 - documentos)]
    IA[OpenAI - vía AI Agent]
    DRIVE[(Backup)]
    MAIL[Email]

    B --> FE --> BE --> DB
    BE -- presigned URL --> R2
    BE -- webhook --> N8N
    N8N --> DB
    N8N --> IA
    N8N --> DRIVE
    N8N --> MAIL
```

## Ciclo de vida — LABORAL

```mermaid
flowchart TD
    A([Toma del cliente]) --> T1[Telegrama 1]
    T1 -->|sin respuesta| T2[Telegrama 2]
    T1 -->|acepta| C[Conciliación]
    T2 -->|sin respuesta| T3[Telegrama 3]
    T2 -->|acepta| C
    T3 --> C
    C -->|acuerdo| AC([Acuerdo - terminal])
    C -->|sin acuerdo| JI[Juicio: Inicial]
    JI --> JP[Producción de pruebas] --> JV[Vista de causa] --> JS([Sentencia - terminal])
```

## Ciclo de vida — ART

```mermaid
flowchart TD
    A([Toma del cliente]) -->|accidente| SRT[SRT / Comisión Médica]
    A -->|enfermedad| DEN[Denuncia ART] --> SRT
    SRT -->|favorable| IND([Indemnización - terminal])
    SRT -->|desfavorable| JI[Juicio: Inicial]
    JI --> JP[Producción de pruebas] --> JV[Vista de causa] --> JS([Sentencia - terminal])
```

## Modelo entidad-relación (resumen)

```mermaid
erDiagram
    USUARIO ||--o{ CASO : "responsable"
    USUARIO ||--o{ REFRESH_TOKEN : "sesión"
    CLIENTE ||--o{ CASO : "titulariza"
    CASO ||--|| FICHA_LABORAL : "admisión"
    CASO ||--o{ TELEGRAMA : "tiene"
    CASO ||--o{ DOCUMENTO : "contiene"
    CASO ||--o{ VENCIMIENTO : "agenda"
    CASO ||--o{ COMUNICACION : "genera"
    CASO ||--o{ HISTORIAL_CASO : "registra"
    ETAPA ||--o{ CASO : "etapa actual"
    ETAPA ||--o{ TRANSICION_ETAPA : "origen/destino"
```

## Secuencia — generación de actualización (IA asistencial)

```mermaid
sequenceDiagram
    actor Abogado
    participant UI as Frontend
    participant API as Backend
    participant N8N as n8n (AI Agent)
    participant IA as OpenAI
    Abogado->>UI: "Generar actualización"
    UI->>API: POST /casos/{id}/actualizacion
    API->>N8N: Webhook (caso_id)
    N8N->>API: GET /internal/casos/{id}/contexto (tool)
    API-->>N8N: contexto acotado
    N8N->>IA: prompt
    IA-->>N8N: borrador
    N8N-->>API: borrador
    API-->>UI: borrador editable
    Abogado->>UI: revisa, edita y aprueba
    Note over Abogado,UI: El envío es manual (RN-10)
```
