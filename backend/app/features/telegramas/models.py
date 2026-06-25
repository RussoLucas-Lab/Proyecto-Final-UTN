"""
Modelos ORM de la feature 'telegramas'.

Tabla DBML v2:
  telegrama — telegramas del flujo Laboral (Ley 23.789). Hasta 3 por caso (RN-16).
              Unique (caso_id, numero).
"""

from datetime import date

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db_base import Base
from app.shared.enums import (
    ResultadoTelegrama,
    TipoComunicacionTelegrama,
    resultado_telegrama_sa,
    tipo_comunicacion_telegrama_sa,
)


class Telegrama(Base):
    __tablename__ = "telegrama"
    __table_args__ = (
        sa.UniqueConstraint("caso_id", "numero", name="uq_telegrama_caso_id_numero"),
    )

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    caso_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("caso.id"),
        nullable=False,
    )
    numero: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        comment="1, 2 o 3",
    )
    resultado: Mapped[ResultadoTelegrama] = mapped_column(
        resultado_telegrama_sa,
        nullable=False,
        server_default=sa.text("'PENDIENTE'"),
    )
    tipo_comunicacion: Mapped[TipoComunicacionTelegrama] = mapped_column(
        tipo_comunicacion_telegrama_sa,
        nullable=False,
        server_default=sa.text("'OTRO'"),
        comment="Radio 'Opciones de comunicación' del PDF oficial",
    )
    destinatario: Mapped[str | None] = mapped_column(
        sa.String(160),
        nullable=True,
        comment="Empleador",
    )
    domicilio_destino: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    cuerpo: Mapped[str | None] = mapped_column(
        sa.Text,
        nullable=True,
        comment="Texto del reclamo (para generar el PDF Ley 23.789)",
    )
    codigo_seguimiento: Mapped[str | None] = mapped_column(
        sa.String(60),
        nullable=True,
        comment="Código que entrega el correo",
    )
    fecha_envio: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    fecha_resultado: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
