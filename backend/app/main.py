import logging

from fastapi import FastAPI, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.middleware import CSRFMiddleware, SecurityHeadersMiddleware
from app.core.rate_limit import limiter
from app.features.auth.router import router as auth_router
from app.features.casos.router import router as casos_router
from app.features.clientes.router import router as clientes_router
from app.features.comunicaciones.router import router as comunicaciones_router
from app.features.documentos.router import router as documentos_router
from app.features.telegramas.router import router as telegramas_router
from app.features.usuarios.router import router as usuarios_router
from app.features.vencimientos.router import router as vencimientos_router

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
    docs_url=None,  # se sirve manualmente abajo con CSRF interceptor
    swagger_ui_parameters={"withCredentials": True},
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


@app.get("/docs", include_in_schema=False)
async def swagger_ui_html() -> HTMLResponse:
    return HTMLResponse("""<!DOCTYPE html>
<html>
<head>
  <title>Iuris API</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
<script>
function getCsrfToken() {
  var m = document.cookie.match('(?:^|;)\\s*csrf_token=([^;]*)');
  return m ? decodeURIComponent(m[1]) : null;
}
window.onload = function () {
  SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
    layout: 'StandaloneLayout',
    withCredentials: true,
    requestInterceptor: function (req) {
      var csrf = getCsrfToken();
      if (csrf) req.headers['X-CSRF-Token'] = csrf;
      return req;
    }
  });
};
</script>
</body>
</html>""")


# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")
app.include_router(clientes_router, prefix="/api/v1")
app.include_router(casos_router, prefix="/api/v1")
app.include_router(comunicaciones_router, prefix="/api/v1")
app.include_router(documentos_router, prefix="/api/v1")
app.include_router(telegramas_router, prefix="/api/v1")
app.include_router(vencimientos_router, prefix="/api/v1")
