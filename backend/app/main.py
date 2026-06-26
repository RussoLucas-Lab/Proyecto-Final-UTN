import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
from app.core.rate_limit import limiter
from app.features.auth.router import router as auth_router
from app.features.casos.router import router as casos_router
from app.features.clientes.router import router as clientes_router
from app.features.usuarios.router import router as usuarios_router

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
_app_logger = logging.getLogger("iuris")
_security_logger = logging.getLogger("iuris.security")

app = FastAPI(
    title="Iuris API",
    description="API de gestión jurídica para el estudio (Laboral y ART).",
    version="0.1.0",
)

# ── Rate limiting (SlowAPI) ────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middlewares de seguridad ───────────────────────────────────────────────────
# SecurityHeadersMiddleware se agrega primero → es el envoltorio más externo →
# agrega headers incluso en respuestas de CSRF rejection (403) y errores (500).
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)


# ── Manejador genérico de errores ──────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Oculta detalles internos al cliente; los registra en el servidor.

    El cliente solo ve {"error": "Internal Server Error"} sin stacktrace ni detalle.
    El log incluye el traceback completo para facilitar el diagnóstico.
    Los loggers de seguridad (iuris.security) nunca registran passwords ni tokens.
    """
    _app_logger.error(
        "Error no controlado | method=%s path=%s",
        request.method,
        request.url.path,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error"},
    )


# ── Infraestructura ────────────────────────────────────────────────────────────
@app.get("/health", tags=["infraestructura"])
def health() -> dict[str, str]:
    """Endpoint de salud. Sin auth, sin DB. (RNF-13)"""
    return {"status": "UP"}


# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")
app.include_router(clientes_router, prefix="/api/v1")
app.include_router(casos_router, prefix="/api/v1")
