"""
Motor de base de datos, sesión y dependencia FastAPI.

Expone:
  engine       — SQLAlchemy Engine configurado con DATABASE_URL.
  SessionLocal — sessionmaker; úsalo directamente si necesitás una
                 sesión fuera del ciclo de vida de FastAPI.
  get_db()     — dependencia FastAPI que abre/cierra la sesión por
                 request y la expone vía Depends().

Ejemplo de uso en un router:
    from fastapi import Depends
    from sqlalchemy.orm import Session
    from app.core.database import get_db

    @router.get("/items")
    def list_items(db: Session = Depends(get_db)):
        ...
"""

from collections.abc import Generator

import sqlalchemy as sa
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = sa.create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # reconecta silenciosamente si la conexión cayó
)

SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


def get_db() -> Generator[Session, None, None]:
    """Dependencia FastAPI: abre una sesión de DB y la cierra al finalizar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
