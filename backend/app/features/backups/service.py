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

from app.features.backups.models import Backup
from app.features.backups.schemas import BackupRegistrarRequest

logger = logging.getLogger("iuris.backups")


# ── Excepciones del dominio ───────────────────────────────────────────────────


class BackupN8nNoDisponible(Exception):
    """El webhook de n8n no respondió o devolvió un error al disparar WF-02."""


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
