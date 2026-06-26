"""Dependencias específicas del feature auth."""

from fastapi import Cookie


def get_refresh_cookie(refresh_token: str | None = Cookie(default=None)) -> str | None:
    """Extrae el refresh token de la cookie de sesión.

    FastAPI lee automáticamente la cookie llamada 'refresh_token'.
    Retorna None si la cookie no está presente.
    """
    return refresh_token
