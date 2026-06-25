"""
Base declarativa de SQLAlchemy con convención de nombres.

Todos los modelos ORM heredan de `Base`. La naming convention
hace que Alembic genere nombres de constraint deterministas,
evitando migraciones inestables en revisiones futuras.

Convenciones aplicadas:
  ix_<column_label>           — índices
  uq_<table>_<column>         — unique constraints
  ck_<table>_<constraint>     — check constraints
  fk_<table>_<col>_<ref_table> — foreign keys
  pk_<table>                  — primary keys
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
