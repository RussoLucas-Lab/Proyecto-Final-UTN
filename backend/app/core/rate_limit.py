"""Instancia compartida del rate limiter (SlowAPI).

Importar `limiter` tanto en main.py (para registrarlo en app.state y agregar
el handler de 429) como en los routers que aplican el decorador @limiter.limit().
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
