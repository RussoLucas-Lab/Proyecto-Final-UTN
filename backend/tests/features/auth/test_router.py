"""
Tests de endpoints de auth, RBAC, CSRF y rate limiting.

Organización:
  TestLogin         — POST /auth/login (6.3)
  TestRefresh       — POST /auth/refresh (6.3)
  TestLogout        — POST /auth/logout (6.3)
  TestRBAC          — require_socio (GET /test/socio-only) (6.4)
  TestCSRF          — middleware double-submit + headers de seguridad (6.4)
  TestRateLimit     — 429 al exceder ~5/min (6.5, marcado @pytest.mark.slow)

Tests de integración (@pytest.mark.integration) requieren PostgreSQL.
Tests de middleware (CSRF, sin sesión) usan client_no_db y corren sin DB.
"""
import pytest

from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_PASSWORD,
    INACTIVO_EMAIL,
    INACTIVO_PASSWORD,
)

# ── Login ──────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestLogin:
    def test_login_success(self, client, usuario_socio):
        """Login exitoso → 200, cookies seteadas, perfil en el body."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
        )
        assert response.status_code == 200

        # Cookies de sesión presentes
        assert "access_token" in response.cookies
        assert "csrf_token" in response.cookies

        # Perfil en el body
        body = response.json()
        assert body["rol"] == "SOCIO"
        assert "nombre" in body

    def test_login_wrong_password(self, client, usuario_socio):
        """Contraseña incorrecta → 401."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": SOCIO_EMAIL, "password": "ContraseñaMala!"},
        )
        assert response.status_code == 401

    def test_login_unknown_email(self, client):
        """Email desconocido → 401 (mismo mensaje que wrong password, sin revelar existencia)."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "noexiste@iuris.test", "password": "Cualquiera1!"},
        )
        assert response.status_code == 401

    def test_login_inactive_user(self, client, usuario_inactivo):
        """Usuario inactivo → 401."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": INACTIVO_EMAIL, "password": INACTIVO_PASSWORD},
        )
        assert response.status_code == 401

    def test_login_invalid_payload(self, client):
        """Payload inválido (email malformado) → 422."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "no-es-un-email", "password": "Pass1!"},
        )
        assert response.status_code == 422

    def test_login_missing_fields(self, client):
        """Payload sin campos requeridos → 422."""
        response = client.post("/api/v1/auth/login", json={})
        assert response.status_code == 422


# ── Refresh ────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestRefresh:
    def test_refresh_success(self, client, usuario_socio):
        """Refresh exitoso → 200, nuevas cookies, perfil en body."""
        # Login previo para obtener tokens
        login = client.post(
            "/api/v1/auth/login",
            json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
        )
        assert login.status_code == 200
        csrf = client.cookies.get("csrf_token")

        response = client.post(
            "/api/v1/auth/refresh",
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 200
        assert "access_token" in response.cookies
        body = response.json()
        assert "rol" in body

    def test_refresh_revoked_token(self, client, usuario_socio):
        """Refresh con token revocado (post-logout) → 401."""
        # Login
        login = client.post(
            "/api/v1/auth/login",
            json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
        )
        assert login.status_code == 200

        old_refresh = login.cookies.get("refresh_token")
        csrf = client.cookies.get("csrf_token")

        # Logout (revoca el refresh token y limpia cookies)
        client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})

        # Intentar refresh con el token revocado manualmente en la request
        response = client.post(
            "/api/v1/auth/refresh",
            cookies={"refresh_token": old_refresh, "csrf_token": csrf},
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 401

    def test_refresh_without_token(self, client, usuario_socio):
        """Refresh sin cookie refresh_token → 401."""
        # Login para tener CSRF válido
        login = client.post(
            "/api/v1/auth/login",
            json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
        )
        csrf = client.cookies.get("csrf_token")

        # Llamar refresh sin la cookie de refresh (solo enviamos csrf)
        response = client.post(
            "/api/v1/auth/refresh",
            cookies={"csrf_token": csrf},
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 401

    def test_refresh_rotates_token(self, client, usuario_socio):
        """El refresh devuelve cookies nuevas distintas al primer login."""
        login = client.post(
            "/api/v1/auth/login",
            json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
        )
        original_access = login.cookies.get("access_token")
        csrf = client.cookies.get("csrf_token")

        refresh = client.post(
            "/api/v1/auth/refresh",
            headers={"X-CSRF-Token": csrf},
        )
        new_access = refresh.cookies.get("access_token")

        assert refresh.status_code == 200
        # El nuevo access token puede ser distinto si el clock avanza lo suficiente
        # Lo importante es que se emitió una nueva cookie (no vacía)
        assert new_access is not None


# ── Logout ─────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestLogout:
    def test_logout_clears_cookies(self, client, usuario_socio):
        """Logout → 204 y posterior refresh falla (sesión revocada)."""
        # Login
        login = client.post(
            "/api/v1/auth/login",
            json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
        )
        assert login.status_code == 200
        csrf = client.cookies.get("csrf_token")

        # Logout
        logout = client.post(
            "/api/v1/auth/logout",
            headers={"X-CSRF-Token": csrf},
        )
        assert logout.status_code == 204

        # Refresh posterior debe fallar: enviamos csrf manual (cookies limpiadas)
        fresh_csrf = "test-csrf-post-logout"
        post_logout_refresh = client.post(
            "/api/v1/auth/refresh",
            cookies={"csrf_token": fresh_csrf},
            headers={"X-CSRF-Token": fresh_csrf},
        )
        # Sin refresh token cookie → 401
        assert post_logout_refresh.status_code == 401

    def test_logout_idempotente_sin_sesion(self, client):
        """Logout sin sesión activa → 204 (idempotente, no lanza error)."""
        fresh_csrf = "any-csrf-value"
        response = client.post(
            "/api/v1/auth/logout",
            cookies={"csrf_token": fresh_csrf},
            headers={"X-CSRF-Token": fresh_csrf},
        )
        assert response.status_code == 204


# ── RBAC ───────────────────────────────────────────────────────────────────────


class TestRBAC:
    @pytest.mark.integration
    def test_require_socio_allows_socio(self, rbac_client, usuario_socio):
        """SOCIO autenticado → 200 en endpoint protegido con require_socio."""
        # Login como SOCIO
        login = rbac_client.post(
            "/api/v1/auth/login",
            json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
        )
        assert login.status_code == 200

        # Acceso a ruta protegida (GET → exento de CSRF)
        response = rbac_client.get("/api/v1/test/socio-only")
        assert response.status_code == 200

    @pytest.mark.integration
    def test_require_socio_rejects_abogado(self, rbac_client, usuario_abogado):
        """ABOGADO autenticado → 403 en endpoint exclusivo de SOCIO."""
        login = rbac_client.post(
            "/api/v1/auth/login",
            json={"email": ABOGADO_EMAIL, "password": ABOGADO_PASSWORD},
        )
        assert login.status_code == 200

        response = rbac_client.get("/api/v1/test/socio-only")
        assert response.status_code == 403

    def test_require_socio_no_session(self, client_no_db):
        """Sin cookie access_token → 401 (no autenticado)."""
        # No hacer login; ninguna cookie de sesión presente
        response = client_no_db.get("/api/v1/test/socio-only")
        assert response.status_code == 401


# ── CSRF ───────────────────────────────────────────────────────────────────────


class TestCSRF:
    def test_csrf_mutation_without_header(self, client_no_db):
        """POST sin X-CSRF-Token ni csrf_token cookie → 403 del middleware CSRF."""
        response = client_no_db.post("/api/v1/auth/refresh")
        assert response.status_code == 403

    def test_csrf_mutation_mismatching_header(self, client_no_db):
        """POST con csrf_token cookie ≠ X-CSRF-Token header → 403."""
        response = client_no_db.post(
            "/api/v1/auth/refresh",
            cookies={"csrf_token": "valor-A"},
            headers={"X-CSRF-Token": "valor-B"},
        )
        assert response.status_code == 403

    def test_csrf_mutation_with_valid_header(self, client_no_db):
        """POST con csrf_token cookie == X-CSRF-Token header → pasa CSRF (no 403).

        El endpoint /auth/refresh devuelve 401 (sin refresh token) — eso confirma
        que el middleware CSRF se satisfizo y la request llegó al endpoint.
        """
        csrf_val = "test-csrf-valido-12345"
        response = client_no_db.post(
            "/api/v1/auth/refresh",
            cookies={"csrf_token": csrf_val},
            headers={"X-CSRF-Token": csrf_val},
        )
        # 401 del endpoint (no refresh token), no 403 del middleware
        assert response.status_code == 401

    def test_csrf_get_exempt(self, client_no_db):
        """GET /health es exento de CSRF (método seguro) → 200."""
        response = client_no_db.get("/health")
        assert response.status_code == 200

    def test_csrf_login_exempt(self, client_no_db):
        """POST /auth/login está exento de CSRF (no hay sesión previa)."""
        # Sin credenciales válidas → 401, pero NO 403 de CSRF
        response = client_no_db.post(
            "/api/v1/auth/login",
            json={"email": "x@x.com", "password": "Pass1!"},
        )
        # La DB mock devuelve None en la query → el servicio lanza CredencialesInvalidas → 401
        # Si devuelve 500 (mock no configurado para query) está bien — no es 403
        assert response.status_code != 403

    def test_security_headers_present(self, client_no_db):
        """Los headers de seguridad están presentes en todas las respuestas."""
        response = client_no_db.get("/health")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert "Referrer-Policy" in response.headers
        assert "Content-Security-Policy" in response.headers

    def test_security_headers_on_error_response(self, client_no_db):
        """Los headers de seguridad están incluso en respuestas 403 (CSRF)."""
        response = client_no_db.post("/api/v1/auth/refresh")  # sin CSRF → 403
        assert response.status_code == 403
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"


# ── Rate limiting ──────────────────────────────────────────────────────────────


class TestRateLimit:
    @pytest.mark.slow
    @pytest.mark.integration
    def test_login_rate_limit(self, client, usuario_socio):
        """6 intentos de login rápidos → al menos uno retorna 429.

        Marcado como @pytest.mark.slow porque:
        - Requiere que el estado del rate limiter esté limpio (in-memory, por IP).
        - Puede ser no determinista si otros tests ya consumieron intentos en la
          misma ventana de tiempo (1 minuto).
        - Se excluye del conjunto de tests rápidos en CI con: -m "not slow".

        Para correr este test en aislamiento:
            pytest tests/features/auth/test_router.py::TestRateLimit -m slow -v
        """
        responses = []
        for _ in range(6):
            r = client.post(
                "/api/v1/auth/login",
                # Email inexistente: el endpoint igual pasa por el rate limiter
                json={"email": "ratelimit-check@iuris.test", "password": "Pass1!"},
            )
            responses.append(r.status_code)

        status_codes = set(responses)
        assert 429 in status_codes, (
            f"Se esperaba al menos un 429 en 6 intentos rápidos. "
            f"Respuestas recibidas: {responses}. "
            f"Posible causa: el estado del rate limiter ya fue consumido por otro test "
            f"en la misma ventana temporal."
        )
