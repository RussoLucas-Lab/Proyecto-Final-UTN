"""
Pydantic schemas de la feature 'backups'.

Endpoints cubiertos:
  GET  /backups            → list[BackupResponse]
  POST /backups            → BackupTriggerResponse (202 Accepted)
  POST /internal/backups   → BackupResponse (201 Created)
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.shared.enums import EstadoBackup, TipoBackup


class BackupResponse(BaseModel):
    """Respuesta con los datos de un registro de backup."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime
    tipo: TipoBackup
    estado: EstadoBackup
    ubicacion: str | None


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
