"""
Dependencias FastAPI propias de la feature comunicaciones.

- verify_internal_secret : autentica llamadas server-to-server de n8n.
    Lee el header X-Internal-Secret y lo compara con N8N_INTERNAL_SECRET
    usando secrets.compare_digest (timing-safe). Lanza 401 si falta o no coincide.
    NO usa get_current_user ni cookies JWT (D3).
- get_caso_o_404         : carga el Caso por caso_id o lanza 404.
"""

import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_db
from app.features.casos.models import Caso


def verify_internal_secret(
    x_internal_secret: str | None = Header(default=None),
) -> None:
    """Dependencia de auth para rutas /internal/*. No usa cookies JWT."""
    if x_internal_secret is None or not secrets.compare_digest(
        x_internal_secret, settings.N8N_INTERNAL_SECRET
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Secreto interno inválido o ausente",
        )


def get_caso_o_404(caso_id: int, db: Session = Depends(get_db)) -> Caso:
    """Dependencia: devuelve el Caso por caso_id o lanza HTTP 404."""
    caso = db.get(Caso, caso_id)
    if caso is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caso no encontrado",
        )
    return caso
