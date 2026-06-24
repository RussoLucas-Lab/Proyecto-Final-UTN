# Glosario de Términos del Dominio

| Término | Definición |
|---------|------------|
| **Estudio jurídico** | Organización cliente del proyecto (anonimizada). Áreas en alcance: Laboral y ART. |
| **Área** | Rama del derecho. En alcance: LABORAL y ART. Cada una tiene su propio ciclo de vida de casos. |
| **ART** | Riesgos del Trabajo. Reclamos por accidente o enfermedad profesional. |
| **Caso** | Asunto legal gestionado. Equivale al expediente. Unidad central del sistema. |
| **Etapa** | Estado del caso dentro de su ciclo de vida. Es un dato configurable (no un enum fijo). |
| **Transición** | Paso permitido de una etapa a otra. El avance es manual; el retroceso requiere confirmación. |
| **Etapa terminal** | Etapa que cierra el caso (Acuerdo, Indemnización, Sentencia). |
| **Telegrama (Ley 23.789)** | Telegrama laboral que se envía al empleador en el flujo Laboral (hasta 3 por caso). |
| **SRT** | Superintendencia de Riesgos del Trabajo. Interviene en el flujo ART. |
| **Cuota litis** | Pacto que el cliente firma al iniciar; marca la toma del caso. |
| **Cliente** | Persona representada por el estudio. |
| **Ficha laboral** | Datos de admisión del trabajo/registración asociados al caso. |
| **SOCIO** | Rol con acceso total, incluida la gestión de usuarios (administra el sistema). |
| **ABOGADO** | Rol operativo completo salvo gestión de usuarios (incluye al personal administrativo, que también es abogado). |
| **Comunicación** | Borrador de mensaje al cliente (manual o automático del batch de 15 días). |
| **IA asistencial** | Uso de modelos de lenguaje para redactar borradores, sin decidir ni enviar. |
| **n8n** | Plataforma de automatización (BPA) que orquesta IA, batch y respaldos. |
| **Documento** | Archivo (PDF/Word/imagen) del caso, almacenado en R2. |
| **R2** | Cloudflare R2: object storage S3-compatible donde se guardan los documentos. |
| **Vencimiento** | Fecha/movimiento a realizar (vista calendario), en días hábiles judiciales. |
| **Backup** | Respaldo automático (cron en n8n) o manual; queda registrado. |
| **Datos sintéticos** | Datos ficticios que replican la estructura real, usados en pruebas y demos. |
