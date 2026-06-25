"""
Modelos ORM de la feature 'documentos'.

Tabla DBML v2:
  documento — documentos asociados a un caso. Solo el abogado sube (RN-12).
              Almacenamiento en Cloudflare R2 (ADR-0007).
"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db_base import Base
from app.shared.enums import (
    CategoriaDocumento,
    FormatoDocumento,
    categoria_documento_sa,
    formato_documento_sa,
)


class Documento(Base):
    __tablename__ = "documento"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    caso_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("caso.id"),
        nullable=False,
        comment="Siempre asociado a un caso (RN-02)",
    )
    categoria: Mapped[CategoriaDocumento] = mapped_column(
        categoria_documento_sa, nullable=False
    )
    formato: Mapped[FormatoDocumento] = mapped_column(
        formato_documento_sa, nullable=False
    )
    nombre_archivo: Mapped[str] = mapped_column(
        sa.String(255),
        nullable=False,
        comment="Convención: categoria_Apellido_Nombre",
    )
    ruta_almacenamiento: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    subido_por: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("usuario.id"),
        nullable=False,
        comment="Solo un usuario/abogado sube documentos",
    )
    subido_en: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
