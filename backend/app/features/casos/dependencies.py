"""
Dependencias FastAPI propias del feature casos.

Expone:
  get_caso_o_404 → carga el caso por id; lanza 404 si no existe.
    Reutilizado en GET /casos/{id}, PUT /casos/{id}/ficha-laboral,
    POST /casos/{id}/avanzar, POST /casos/{id}/retroceder,
    GET /casos/{id}/historial.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.features.casos.models import Caso


def get_caso_o_404(id: int, db: Session = Depends(get_db)) -> Caso:
    """Dependencia: devuelve el Caso o lanza HTTP 404."""
    caso = db.get(Caso, id)
    if caso is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caso no encontrado",
        )
    return caso
