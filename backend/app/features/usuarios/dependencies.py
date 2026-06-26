"""
Dependencias FastAPI propias del feature usuarios.

Por ahora no hay dependencias adicionales: el feature reutiliza
get_current_user, require_socio y get_db de app.core.dependencies.
Los errores 404 de usuario se manejan en el service.
"""
# Sin dependencias propias en esta versión — archivo requerido por la
# estructura de feature (ADR-0009); se poblará si aparecen dependencias
# específicas (p. ej. get_usuario_o_404 si varios endpoints lo reutilizan).
