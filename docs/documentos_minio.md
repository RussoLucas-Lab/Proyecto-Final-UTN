Contexto: el change "documentos" (RF-14/RF-15, UC-05, RN-02, RN-12, ADR-0007) 
requiere subida de archivos vía URL prefirmada de Cloudflare R2 (init→PUT→registrar) 
y descarga vía URL prefirmada (GET /documentos/{id}/url).

Quiero abstraer el storage para que:
1. En desarrollo/testing use MinIO (corriendo en Docker Compose local), 
   que expone API S3-compatible idéntica a R2.
2. En producción use Cloudflare R2 real.
3. El código de la feature `documentos` (backend) NO debe saber cuál de los 
   dos está usando — solo cambia configuración por variable de entorno 
   (endpoint_url, access_key, secret_key, bucket_name), igual que boto3 
   contra cualquier S3-compatible.

Antes de tocar código, quiero que primero evalúes si esto amerita:
a) Ser parte del design.md del change "documentos" (una decisión técnica más, 
   ej. D-x: "Storage backend configurable vía env, MinIO en dev / R2 en prod"), o
b) Un change/ADR separado de infraestructura (ej. ADR-0010 o un change 
   "storage-infra") si esto va a ser reusado por otras features además de 
   documentos.

Dame tu recomendación con justificación breve (siguiendo ADR-0009 feature-first 
y el principio de "spec artifacts as source of truth") antes de generar 
ningún artefacto. Una vez que confirme el enfoque, segui el flujo OpenSpec 
normal (propose → design → spec → tasks) para lo que corresponda.

Restricciones a respetar:
- No se agrega tarjeta de crédito ni cuenta R2 real en esta etapa; MinIO debe 
  levantar 100% local vía docker-compose, con bucket creado automáticamente 
  al iniciar (mc mb + políticas básicas).
- El cliente S3 (boto3) debe ser el mismo objeto/abstracción para ambos 
  entornos; solo difiere la configuración inyectada.
- No reimplementar lógica de URLs prefirmadas que ya esté contemplada en 
  ADR-0007 — reusar ese diseño, solo cambiar el backend de storage detrás.
- Si esto toca el contrato de API de documentos (init→PUT→registrar) o las 
  variables de entorno documentadas, registralo como desvío en el changemap 
  como venimos haciendo con D2 en usuarios y clientes.