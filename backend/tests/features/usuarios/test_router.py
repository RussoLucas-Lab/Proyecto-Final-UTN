"""
Tests de endpoints de usuarios: CRUD, RBAC, CSRF y seguridad de datos.

Organización:
  TestListarUsuarios     — GET /usuarios (4.2)
  TestCrearUsuario       — POST /usuarios (4.3)
  TestEditarUsuario      — PUT /usuarios/{id} (4.4)
  TestCambiarActivacion  — PATCH /usuarios/{id} (4.5)
  TestSeguridadPassword  — contraseña hasheada, verify_password (4.6)
  TestCSRFUsuarios       — CSRF en mutaciones (4.3)

Tests de integración (@pytest.mark.integration) requieren PostgreSQL.
Tests de CSRF y sin sesión (TestCSRFUsuarios) usan client_no_db y corren sin DB.
"""

import pytest

from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_PASSWORD,
)

# ── Helpers ────────────────────────────────────────────────────────────────────

NUEVO_USUARIO_ABOGADO = {
    "email": "nuevo-abogado@iuris.test",
    "password": "Pass123!",
    "nombre": "Nuevo Abogado",
    "rol": "ABOGADO",
    "area": "LABORAL",
    "matricula": "MZA-9999",
}

NUEVO_USUARIO_SOCIO = {
    "email": "nuevo-socio@iuris.test",
    "password": "Pass123!",
    "nombre": "Nuevo Socio",
    "rol": "SOCIO",
    "area": None,
    "matricula": None,
}


def _login_socio(client):
    """Realiza login como SOCIO y devuelve el CSRF token."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
    )
    assert resp.status_code == 200
    return client.cookies.get("csrf_token")


def _login_abogado(client):
    """Realiza login como ABOGADO y devuelve el CSRF token."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": ABOGADO_EMAIL, "password": ABOGADO_PASSWORD},
    )
    assert resp.status_code == 200
    return client.cookies.get("csrf_token")


# ── GET /usuarios ──────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestListarUsuarios:
    def test_get_usuarios_autenticado_200(self, client, usuario_socio):
        """GET /usuarios con sesión activa → 200 y lista de usuarios."""
        _login_socio(client)
        resp = client.get("/api/v1/usuarios")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) >= 1

    def test_get_usuarios_sin_sesion_401(self, client):
        """GET /usuarios sin sesión → 401."""
        resp = client.get("/api/v1/usuarios")
        assert resp.status_code == 401

    def test_get_usuarios_no_contiene_password_hash(self, client, usuario_socio):
        """La respuesta de GET /usuarios NO debe contener password_hash en ningún elemento."""
        _login_socio(client)
        resp = client.get("/api/v1/usuarios")
        assert resp.status_code == 200
        for usuario in resp.json():
            assert "password_hash" not in usuario, (
                "password_hash no debe aparecer en ninguna respuesta de usuario"
            )

    def test_get_usuarios_abogado_puede_leer(self, client, usuario_socio, usuario_abogado):
        """ABOGADO autenticado también puede leer la lista (RN-08: lectura amplia)."""
        _login_abogado(client)
        resp = client.get("/api/v1/usuarios")
        assert resp.status_code == 200


# ── POST /usuarios ─────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestCrearUsuario:
    def test_post_usuario_socio_201(self, client, usuario_socio):
        """SOCIO crea un ABOGADO → 201 con datos del nuevo usuario."""
        csrf = _login_socio(client)
        resp = client.post(
            "/api/v1/usuarios",
            json=NUEVO_USUARIO_ABOGADO,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["email"] == NUEVO_USUARIO_ABOGADO["email"]
        assert body["rol"] == "ABOGADO"
        assert body["activo"] is True
        assert "password_hash" not in body

    def test_post_usuario_email_duplicado_409(self, client, usuario_socio):
        """Email ya registrado → 409 Conflict."""
        csrf = _login_socio(client)
        # Crear por primera vez
        client.post(
            "/api/v1/usuarios",
            json=NUEVO_USUARIO_ABOGADO,
            headers={"X-CSRF-Token": csrf},
        )
        # Intentar crear con el mismo email
        resp = client.post(
            "/api/v1/usuarios",
            json=NUEVO_USUARIO_ABOGADO,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 409

    def test_post_usuario_payload_invalido_422(self, client, usuario_socio):
        """Email malformado → 422 Unprocessable Entity."""
        csrf = _login_socio(client)
        resp = client.post(
            "/api/v1/usuarios",
            json={"email": "no-es-email", "password": "Pass1!", "nombre": "Test", "rol": "ABOGADO", "area": "LABORAL"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 422

    def test_post_usuario_abogado_sin_area_422(self, client, usuario_socio):
        """ABOGADO sin área → 422 (incoherencia rol/área, D6)."""
        csrf = _login_socio(client)
        resp = client.post(
            "/api/v1/usuarios",
            json={
                "email": "abogado-sin-area@iuris.test",
                "password": "Pass123!",
                "nombre": "Sin Area",
                "rol": "ABOGADO",
                "area": None,
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 422

    def test_post_usuario_abogado_403(self, client, usuario_socio, usuario_abogado):
        """ABOGADO intentando crear usuario → 403 Forbidden."""
        csrf = _login_abogado(client)
        resp = client.post(
            "/api/v1/usuarios",
            json=NUEVO_USUARIO_ABOGADO,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 403

    def test_post_usuario_sin_csrf_403(self, client, usuario_socio):
        """POST /usuarios sin X-CSRF-Token → 403 del middleware CSRF."""
        _login_socio(client)
        resp = client.post(
            "/api/v1/usuarios",
            json=NUEVO_USUARIO_ABOGADO,
            # Sin header X-CSRF-Token
        )
        assert resp.status_code == 403

    def test_post_usuario_response_no_tiene_password_hash(self, client, usuario_socio):
        """El body de 201 no contiene password_hash."""
        csrf = _login_socio(client)
        resp = client.post(
            "/api/v1/usuarios",
            json=NUEVO_USUARIO_ABOGADO,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 201
        assert "password_hash" not in resp.json()


# ── PUT /usuarios/{id} ─────────────────────────────────────────────────────────


@pytest.mark.integration
class TestEditarUsuario:
    def test_put_usuario_200(self, client, usuario_socio, usuario_abogado):
        """SOCIO edita un usuario existente → 200 con datos actualizados."""
        csrf = _login_socio(client)
        nuevo_nombre = "Abogado Editado"
        resp = client.put(
            f"/api/v1/usuarios/{usuario_abogado.id}",
            json={
                "nombre": nuevo_nombre,
                "rol": "ABOGADO",
                "area": "ART",
                "matricula": "MZA-0001",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["nombre"] == nuevo_nombre
        assert body["area"] == "ART"
        assert "password_hash" not in body

    def test_put_usuario_inexistente_404(self, client, usuario_socio):
        """Usuario inexistente → 404 Not Found."""
        csrf = _login_socio(client)
        resp = client.put(
            "/api/v1/usuarios/99999",
            json={"nombre": "Test", "rol": "ABOGADO", "area": "LABORAL"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    def test_put_usuario_abogado_403(self, client, usuario_socio, usuario_abogado):
        """ABOGADO intentando editar → 403."""
        csrf = _login_abogado(client)
        resp = client.put(
            f"/api/v1/usuarios/{usuario_socio.id}",
            json={"nombre": "Hackeado", "rol": "SOCIO"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 403

    def test_put_usuario_abogado_sin_area_422(self, client, usuario_socio, usuario_abogado):
        """Editar usuario cambiando a ABOGADO sin área → 422."""
        csrf = _login_socio(client)
        resp = client.put(
            f"/api/v1/usuarios/{usuario_abogado.id}",
            json={"nombre": "Test", "rol": "ABOGADO", "area": None},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 422

    def test_put_usuario_no_modifica_email(self, client, usuario_socio, usuario_abogado):
        """El email no cambia aunque no se incluya en el PUT (es inmutable)."""
        csrf = _login_socio(client)
        email_original = usuario_abogado.email
        resp = client.put(
            f"/api/v1/usuarios/{usuario_abogado.id}",
            json={"nombre": "Nuevo Nombre", "rol": "ABOGADO", "area": "LABORAL"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == email_original


# ── PATCH /usuarios/{id} ───────────────────────────────────────────────────────


@pytest.mark.integration
class TestCambiarActivacion:
    def test_patch_desactivar_otro_200(self, client, usuario_socio, usuario_abogado):
        """SOCIO desactiva a otro usuario → 200; registro persiste con activo=false."""
        csrf = _login_socio(client)
        resp = client.patch(
            f"/api/v1/usuarios/{usuario_abogado.id}",
            json={"activo": False},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["activo"] is False
        assert body["id"] == usuario_abogado.id  # registro persiste

    def test_patch_reactivar_200(self, client, usuario_socio, usuario_abogado):
        """SOCIO reactiva a un usuario desactivado → 200 con activo=true."""
        csrf = _login_socio(client)
        # Primero desactivar
        client.patch(
            f"/api/v1/usuarios/{usuario_abogado.id}",
            json={"activo": False},
            headers={"X-CSRF-Token": csrf},
        )
        # Luego reactivar
        resp = client.patch(
            f"/api/v1/usuarios/{usuario_abogado.id}",
            json={"activo": True},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["activo"] is True

    def test_patch_autodesactivacion_socio_409(self, client, usuario_socio):
        """SOCIO intentando desactivarse a sí mismo → 409 Conflict (D5)."""
        csrf = _login_socio(client)
        resp = client.patch(
            f"/api/v1/usuarios/{usuario_socio.id}",
            json={"activo": False},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 409

    def test_patch_usuario_inexistente_404(self, client, usuario_socio):
        """Usuario inexistente → 404."""
        csrf = _login_socio(client)
        resp = client.patch(
            "/api/v1/usuarios/99999",
            json={"activo": False},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    def test_patch_abogado_403(self, client, usuario_socio, usuario_abogado):
        """ABOGADO intentando cambiar activación → 403."""
        csrf = _login_abogado(client)
        resp = client.patch(
            f"/api/v1/usuarios/{usuario_socio.id}",
            json={"activo": False},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 403

    def test_patch_baja_logica_registro_persiste(self, client, usuario_socio, usuario_abogado):
        """Al desactivar, el registro permanece en DB (no se borra físicamente)."""
        csrf = _login_socio(client)
        resp = client.patch(
            f"/api/v1/usuarios/{usuario_abogado.id}",
            json={"activo": False},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200

        # El registro sigue existiendo: GET /usuarios lo devuelve con activo=false
        _login_socio(client)  # renovar sesión si es necesario
        lista = client.get("/api/v1/usuarios")
        ids = [u["id"] for u in lista.json()]
        assert usuario_abogado.id in ids

        usuario_en_lista = next(u for u in lista.json() if u["id"] == usuario_abogado.id)
        assert usuario_en_lista["activo"] is False


# ── Seguridad: contraseña ──────────────────────────────────────────────────────


@pytest.mark.integration
class TestSeguridadPassword:
    def test_password_se_guarda_hasheada(self, client, usuario_socio, db_session):
        """La contraseña se guarda hasheada en DB; no se almacena en texto plano."""
        from app.features.auth.models import Usuario
        from sqlalchemy import select

        csrf = _login_socio(client)
        password_en_claro = "MiPassword123!"
        resp = client.post(
            "/api/v1/usuarios",
            json={
                "email": "hash-test@iuris.test",
                "password": password_en_claro,
                "nombre": "Hash Test",
                "rol": "ABOGADO",
                "area": "LABORAL",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 201

        # Consultar directamente la DB
        nuevo_id = resp.json()["id"]
        user_db = db_session.get(Usuario, nuevo_id)
        assert user_db is not None
        assert user_db.password_hash != password_en_claro, (
            "La contraseña NO debe guardarse en texto plano"
        )
        assert user_db.password_hash.startswith("$2b$") or user_db.password_hash.startswith("$2a$"), (
            "Se esperaba un hash bcrypt"
        )

    def test_verify_password_valida_contraseña_inicial(self, client, usuario_socio, db_session):
        """verify_password valida la contraseña inicial del usuario recién creado."""
        from app.core.security import verify_password
        from app.features.auth.models import Usuario

        csrf = _login_socio(client)
        password_inicial = "ContraseñaInicial!"
        resp = client.post(
            "/api/v1/usuarios",
            json={
                "email": "verify-test@iuris.test",
                "password": password_inicial,
                "nombre": "Verify Test",
                "rol": "ABOGADO",
                "area": "ART",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 201
        nuevo_id = resp.json()["id"]

        user_db = db_session.get(Usuario, nuevo_id)
        assert verify_password(password_inicial, user_db.password_hash), (
            "verify_password debe validar la contraseña inicial correctamente"
        )

    def test_nuevo_usuario_puede_hacer_login(self, client, usuario_socio):
        """El usuario creado puede autenticarse con su contraseña inicial."""
        csrf = _login_socio(client)
        email = "login-test@iuris.test"
        password = "LoginTest123!"
        resp = client.post(
            "/api/v1/usuarios",
            json={
                "email": email,
                "password": password,
                "nombre": "Login Test",
                "rol": "ABOGADO",
                "area": "LABORAL",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 201

        # Logout de SOCIO y login con el nuevo usuario
        client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login_resp.status_code == 200


# ── CSRF en mutaciones ─────────────────────────────────────────────────────────


class TestCSRFUsuarios:
    def test_post_sin_csrf_403(self, client_no_db):
        """POST /usuarios sin X-CSRF-Token → 403 del middleware."""
        resp = client_no_db.post(
            "/api/v1/usuarios",
            json=NUEVO_USUARIO_ABOGADO,
        )
        assert resp.status_code == 403

    def test_put_sin_csrf_403(self, client_no_db):
        """PUT /usuarios/{id} sin X-CSRF-Token → 403 del middleware."""
        resp = client_no_db.put(
            "/api/v1/usuarios/1",
            json={"nombre": "Test", "rol": "ABOGADO", "area": "LABORAL"},
        )
        assert resp.status_code == 403

    def test_patch_sin_csrf_403(self, client_no_db):
        """PATCH /usuarios/{id} sin X-CSRF-Token → 403 del middleware."""
        resp = client_no_db.patch(
            "/api/v1/usuarios/1",
            json={"activo": False},
        )
        assert resp.status_code == 403

    def test_get_sin_sesion_401(self, client_no_db):
        """GET /usuarios sin sesión activa → 401 (la DB mock devuelve None al query de user)."""
        resp = client_no_db.get("/api/v1/usuarios")
        # 401 porque get_current_user falla sin cookie access_token
        assert resp.status_code == 401
