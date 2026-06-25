"""
Modelos ORM de la feature 'clientes'.

Tabla DBML v2:
  cliente — datos de la persona. DNI único en el estudio (RN-03).
            Domicilio real con campos separados: CP / Localidad / Provincia.
"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db_base import Base


class Cliente(Base):
    __tablename__ = "cliente"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    dni: Mapped[str] = mapped_column(
        sa.String(20),
        unique=True,
        nullable=False,
        comment="Único en el estudio (RN-03)",
    )
    cuil: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    telefono: Mapped[str | None] = mapped_column(sa.String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(sa.String(120), nullable=True)
    domicilio_real: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    domicilio_real_cp: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    domicilio_real_localidad: Mapped[str | None] = mapped_column(
        sa.String(120), nullable=True
    )
    domicilio_real_provincia: Mapped[str | None] = mapped_column(
        sa.String(120), nullable=True
    )
    domicilio_coincide_dni: Mapped[bool | None] = mapped_column(
        sa.Boolean, nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
