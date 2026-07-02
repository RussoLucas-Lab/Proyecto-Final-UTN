"""
Servicio de la feature 'backups' (RF-21, RF-22, ADR-0003).

Funciones públicas:
  registrar_backup         → persiste el registro de backup creado por n8n.
  listar_backups           → devuelve el historial ordenado por fecha DESC.
  trigger_backup_manual    → dispara el webhook WF-02 en n8n (fire-and-forget HTTP).

Flujo:
  SOCIO → POST /backups → trigger_backup_manual (llama WF-02 webhook)
  n8n   → ejecuta backup → POST /internal/backups → registrar_backup

Regla ADR-0003 ("IA solo en n8n"):
  Este módulo NO contiene LLM, prompts ni claves de OpenAI.
  Solo dispara webhooks HTTP hacia n8n. La lógica de backup vive en WF-02.
"""

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.storage import StorageClient
from app.features.backups.models import Backup
from app.features.backups.schemas import BackupDownloadResponse, BackupRegistrarRequest
from app.shared.enums import EstadoBackup

logger = logging.getLogger("iuris.backups")

# Prefijo del object key en storage donde WF-02 sube los Excel de respaldo.
# WF-02 sube a `backups/<archivo>` y registra en `ubicacion` solo `<archivo>`.
_BACKUP_PREFIX = "backups/"
_EXPIRES_DOWNLOAD = 3600


# ── Excepciones del dominio ───────────────────────────────────────────────────


class BackupN8nNoDisponible(Exception):
    """El webhook de n8n no respondió o devolvió un error al disparar WF-02."""


class BackupNoEncontrado(Exception):
    """No existe un backup con ese id."""


class BackupNoDescargable(Exception):
    """El backup existe pero no tiene archivo asociado (estado ERROR o sin ubicación)."""


# ── Funciones de servicio ─────────────────────────────────────────────────────


def registrar_backup(db: Session, data: BackupRegistrarRequest) -> Backup:
    """Persiste un registro de backup creado por n8n (POST /internal/backups).

    - `fecha` default: now() si data.fecha es None (server_default del modelo).
    - No valida unicidad: cada ejecución de n8n crea un registro independiente.
    """
    from datetime import datetime, timezone

    kwargs: dict = {
        "tipo": data.tipo,
        "estado": data.estado,
        "ubicacion": data.ubicacion,
    }
    if data.fecha is not None:
        kwargs["fecha"] = data.fecha
    else:
        kwargs["fecha"] = datetime.now(tz=timezone.utc)

    backup = Backup(**kwargs)
    db.add(backup)
    db.commit()
    db.refresh(backup)
    return backup


def listar_backups(db: Session) -> list[Backup]:
    """Devuelve todos los registros de backup ordenados por fecha DESC (RF-22)."""
    filas = db.execute(
        select(Backup).order_by(Backup.fecha.desc())
    ).scalars().all()
    return list(filas)


def get_backup_download_url(
    db: Session, backup_id: int, storage: StorageClient
) -> BackupDownloadResponse:
    """Genera una URL prefirmada de descarga (GET S3) para el Excel de un backup.

    La URL se firma contra el endpoint PÚBLICO (internal=False, default): la
    consume el navegador del SOCIO, no un servicio interno.

    - Lanza BackupNoEncontrado si el id no existe.
    - Lanza BackupNoDescargable si el backup falló (estado ERROR) o no tiene
      ubicación: no hay archivo que descargar.
    """
    backup = db.get(Backup, backup_id)
    if backup is None:
        raise BackupNoEncontrado(f"Backup {backup_id} no encontrado")
    if backup.estado != EstadoBackup.OK or not backup.ubicacion:
        raise BackupNoDescargable(f"Backup {backup_id} sin archivo descargable")

    object_key = f"{_BACKUP_PREFIX}{backup.ubicacion}"
    download_url = storage.generate_presigned_url(
        "get_object", object_key, _EXPIRES_DOWNLOAD
    )
    return BackupDownloadResponse(download_url=download_url, expires_in=_EXPIRES_DOWNLOAD)


def trigger_backup_manual(webhook_url: str, internal_secret: str) -> None:
    """Dispara el webhook WF-02 de n8n para iniciar un respaldo manual (RF-21).

    Envía POST al webhook con el header X-Internal-Secret. Si n8n no responde,
    devuelve un error 4xx/5xx o hay un error de conexión → lanza
    BackupN8nNoDisponible. El backend devuelve 503 al SOCIO.

    Usa httpx síncrono con timeout corto: el webhook de WF-02 responde
    inmediatamente (no hay AI callback como en WF-01). El trabajo real ocurre
    en background en n8n y el resultado llega via POST /internal/backups.
    """
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                webhook_url,
                json={"source": "manual"},
                headers={"X-Internal-Secret": internal_secret},
            )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("Webhook n8n WF-02 no disponible | error=%s", exc)
        raise BackupN8nNoDisponible(str(exc))
