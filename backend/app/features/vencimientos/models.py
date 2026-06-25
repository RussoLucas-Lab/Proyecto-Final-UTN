"""
Modelos ORM de la feature 'vencimientos'.

Tabla DBML v2:
  vencimiento — agenda de movimientos del caso. Índice fecha.
                Visible para todo el estudio; sin notificaciones automáticas.
"""

from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db_base import Base


class Vencimiento(Base):
    __tablename__ = "vencimiento"
    __table_args__ = (sa.Index("ix_vencimiento_fecha", "fecha"),)

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    caso_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("caso.id"),
        nullable=False,
    )
    descripcion: Mapped[str] = mapped_column(
        sa.String(255),
        nullable=False,
        comment="p.ej. Presentar demanda",
    )
    fecha: Mapped[date] = mapped_column(sa.Date, nullable=False)
    completado: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("false")
    )
    creado_por: Mapped[int | None] = mapped_column(
        sa.Integer,
        sa.ForeignKey("usuario.id"),
        nullable=True,
    )
    creado_en: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
