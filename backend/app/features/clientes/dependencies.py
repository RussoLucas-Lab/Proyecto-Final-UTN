"""
Dependencias FastAPI propias del feature clientes.

Expone:
  get_cliente_o_404 → carga el cliente por id; lanza 404 si no existe.
    Reutilizado en GET /clientes/{id} y PUT /clientes/{id}.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.features.clientes.models import Cliente


def get_cliente_o_404(id: int, db: Session = Depends(get_db)) -> Cliente:
    """Dependencia: devuelve el Cliente o lanza HTTP 404."""
    cliente = db.get(Cliente, id)
    if cliente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )
    return cliente
