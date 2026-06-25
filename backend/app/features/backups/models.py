"""
Modelos ORM de la feature 'backups'.

Tabla DBML v2:
  backup — historial de respaldos ejecutados por n8n (WF-02).
"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db_base import Base
from app.shared.enums import EstadoBackup, TipoBackup, estado_backup_sa, tipo_backup_sa


class Backup(Base):
    __tablename__ = "backup"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    fecha: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
    tipo: Mapped[TipoBackup] = mapped_column(tipo_backup_sa, nullable=False)
    estado: Mapped[EstadoBackup] = mapped_column(estado_backup_sa, nullable=False)
    ubicacion: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
