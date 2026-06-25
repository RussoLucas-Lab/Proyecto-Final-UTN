"""
Modelos ORM de la feature 'comunicaciones'.

Tabla DBML v2:
  comunicacion — borradores de actualización generados por IA (n8n).
                 Índices: caso_id, estado.
                 Batch automático cada 15 días + manuales.
                 Siempre revisión humana antes de enviar (RN-10).
"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db_base import Base
from app.shared.enums import (
    EstadoComunicacion,
    TipoComunicacion,
    estado_comunicacion_sa,
    tipo_comunicacion_sa,
)


class Comunicacion(Base):
    __tablename__ = "comunicacion"
    __table_args__ = (
        sa.Index("ix_comunicacion_caso_id", "caso_id"),
        sa.Index("ix_comunicacion_estado", "estado"),
    )

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    caso_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("caso.id"),
        nullable=False,
    )
    contenido: Mapped[str] = mapped_column(
        sa.Text,
        nullable=False,
        comment="Borrador generado por la IA (n8n)",
    )
    tipo: Mapped[TipoComunicacion] = mapped_column(tipo_comunicacion_sa, nullable=False)
    estado: Mapped[EstadoComunicacion] = mapped_column(
        estado_comunicacion_sa,
        nullable=False,
        server_default=sa.text("'PENDIENTE_REVISION'"),
    )
    generado_en: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
    aprobado_por: Mapped[int | None] = mapped_column(
        sa.Integer,
        sa.ForeignKey("usuario.id"),
        nullable=True,
        comment="Usuario que revisó/aprobó. El envío por WhatsApp es manual",
    )
    aprobado_en: Mapped[datetime | None] = mapped_column(sa.DateTime, nullable=True)
