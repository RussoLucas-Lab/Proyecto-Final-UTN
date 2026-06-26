"""
Middlewares de seguridad transversales.

- CSRFMiddleware           → CSRF double-submit cookie (403 si X-CSRF-Token no coincide)
- SecurityHeadersMiddleware → headers de seguridad en todas las respuestas HTTP
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

security_logger = logging.getLogger("iuris.security")

# Métodos HTTP que no modifican estado → exentos de validación CSRF
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# Paths exentos de CSRF: el login no tiene sesión previa, emite la cookie csrf_token
_CSRF_EXEMPT_PATHS = frozenset({"/api/v1/auth/login"})

# Paths de la UI de desarrollo — se omite CSP estricta para que Swagger cargue
_SWAGGER_PATHS = frozenset({"/docs", "/redoc", "/openapi.json"})


class CSRFMiddleware(BaseHTTPMiddleware):
    """Middleware CSRF double-submit cookie (RNF-11, D4).

    Flujo:
    - Métodos seguros (GET/HEAD/OPTIONS): sin restricción.
    - POST /api/v1/auth/login: exento (primer request, sin sesión aún). El endpoint
      emite la cookie csrf_token para que las siguientes mutaciones la usen.
    - Resto de mutaciones (POST/PUT/PATCH/DELETE): exige que el header X-CSRF-Token
      coincida exactamente con la cookie csrf_token → 403 si falta o no coincide.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in _SAFE_METHODS:
            return await call_next(request)

        if request.url.path in _CSRF_EXEMPT_PATHS:
            return await call_next(request)

        csrf_cookie = request.cookies.get("csrf_token")
        csrf_header = request.headers.get("X-CSRF-Token")

        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            security_logger.warning(
                "CSRF validation failed | method=%s path=%s ip=%s",
                request.method,
                request.url.path,
                request.client.host if request.client else "unknown",
            )
            return JSONResponse(
                status_code=403,
                content={"error": "CSRF token inválido o ausente"},
            )

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Agrega headers de seguridad obligatorios a todas las respuestas HTTP (RNF-11).

    Headers incluidos:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - Referrer-Policy: strict-origin
    - Content-Security-Policy: política base
    - Strict-Transport-Security: HSTS (1 año)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        if request.url.path not in _SWAGGER_PATHS:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            )
        return response
