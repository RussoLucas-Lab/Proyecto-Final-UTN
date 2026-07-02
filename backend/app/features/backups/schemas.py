"""
Pydantic schemas de la feature 'backups'.

Endpoints cubiertos:
  GET  /backups            → list[BackupResponse]
  POST /backups            → BackupTriggerResponse (202 Accepted)
  POST /internal/backups   → BackupResponse (201 Created)
"""

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer

from app.shared.enums import EstadoBackup, TipoBackup


class BackupResponse(BaseModel):
    """Respuesta con los datos de un registro de backup."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime
    tipo: TipoBackup
    estado: EstadoBackup
    ubicacion: str | None

    @field_serializer("fecha")
    def _serialize_fecha(self, dt: datetime) -> str:
        """Emite la fecha como ISO 8601 UTC explícito (sufijo +00:00).

        `fecha` se persiste en UTC pero en una columna naive (sin tz), por lo que
        al serializar hay que marcarla como UTC. Sin esto, el frontend interpreta
        el string sin zona como hora local y muestra una hora corrida (RN: hora AR).
        """
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class BackupRegistrarRequest(BaseModel):
    """Payload enviado por n8n al finalizar un respaldo (POST /internal/backups).

    n8n informa tipo, estado y la ubicación del archivo en storage.
    `fecha` es opcional: si no viene, el servicio usa now().
    """

    tipo: TipoBackup
    estado: EstadoBackup
    ubicacion: str | None = None
    fecha: datetime | None = None


class BackupTriggerResponse(BaseModel):
    """Respuesta del POST /backups: confirma que el respaldo fue encolado en n8n."""

    mensaje: str


class BackupDownloadResponse(BaseModel):
    """Respuesta del GET /backups/{id}/download: URL prefirmada de descarga."""

    download_url: str
    expires_in: int
