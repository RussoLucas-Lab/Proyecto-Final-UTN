"""
Tests unitarios del service de documentos.

Todos los tests usan mocks de DB y StorageClient — no requieren PostgreSQL.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

BACKEND_DIR = Path(__file__).parent.parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.features.documentos.schemas import (
    DocumentoInitRequest,
    DocumentoRegisterRequest,
)
from app.features.documentos.service import (
    CasoNoEncontrado,
    DocumentoNoEncontrado,
    get_download_url,
    init_upload,
    list_documentos,
    register_documento,
)
from app.shared.enums import CategoriaDocumento, FormatoDocumento


def _make_db(caso_exists=True, doc=None):
    db = MagicMock()
    from app.features.casos.models import Caso

    db.get.side_effect = lambda model, pk: (
        MagicMock(spec=Caso, id=pk) if (model is Caso and caso_exists)
        else doc if model.__name__ == "Documento"
        else None
    )
    return db


def _make_storage(url="https://signed.example.com/key"):
    storage = MagicMock()
    storage.generate_presigned_url.return_value = url
    return storage


# ── init_upload ────────────────────────────────────────────────────────────────


class TestInitUpload:
    def test_genera_object_key_con_formato_correcto(self):
        db = MagicMock()
        from app.features.casos.models import Caso
        db.get.return_value = MagicMock(spec=Caso, id=1)

        storage = _make_storage("https://signed.url/obj")
        req = DocumentoInitRequest(
            nombre_archivo="dni_test.pdf",
            categoria=CategoriaDocumento.DNI,
            formato=FormatoDocumento.PDF,
        )

        result = init_upload(1, req, storage, db)

        assert result.object_key.startswith("casos/1/")
        assert result.object_key.endswith(".pdf")
        assert result.expires_in == 300
        assert result.upload_url == "https://signed.url/obj"

    def test_llama_presigned_url_con_put_object(self):
        db = MagicMock()
        from app.features.casos.models import Caso
        db.get.return_value = MagicMock(spec=Caso, id=1)

        storage = _make_storage()
        req = DocumentoInitRequest(
            nombre_archivo="foto.jpg",
            categoria=CategoriaDocumento.OTRO,
            formato=FormatoDocumento.IMAGEN,
        )

        init_upload(1, req, storage, db)

        storage.generate_presigned_url.assert_called_once()
        call_args = storage.generate_presigned_url.call_args
        assert call_args[0][0] == "put_object"
        assert call_args[0][2] == 300

    def test_caso_inexistente_lanza_excepcion(self):
        db = MagicMock()
        db.get.return_value = None
        storage = _make_storage()
        req = DocumentoInitRequest(
            nombre_archivo="x.pdf",
            categoria=CategoriaDocumento.DNI,
            formato=FormatoDocumento.PDF,
        )

        with pytest.raises(CasoNoEncontrado):
            init_upload(999, req, storage, db)

    def test_ext_doc_mapeada_correctamente(self):
        db = MagicMock()
        from app.features.casos.models import Caso
        db.get.return_value = MagicMock(spec=Caso, id=5)

        storage = _make_storage()
        req = DocumentoInitRequest(
            nombre_archivo="contrato.doc",
            categoria=CategoriaDocumento.OTRO,
            formato=FormatoDocumento.DOC,
        )

        result = init_upload(5, req, storage, db)
        assert result.object_key.endswith(".doc")


# ── register_documento ────────────────────────────────────────────────────────


class TestRegisterDocumento:
    def _make_db_for_register(self, caso_id=1):
        db = MagicMock()
        from app.features.casos.models import Caso
        db.get.return_value = MagicMock(spec=Caso, id=caso_id)

        def _refresh(obj):
            obj.id = 42
            obj.subido_en = "2026-06-29T00:00:00"

        db.refresh.side_effect = _refresh
        return db

    def test_crea_documento_con_ruta_almacenamiento(self):
        db = self._make_db_for_register()
        req = DocumentoRegisterRequest(
            object_key="casos/1/abc.pdf",
            nombre_archivo="dni_test.pdf",
            categoria=CategoriaDocumento.DNI,
            formato=FormatoDocumento.PDF,
        )

        doc = register_documento(1, req, usuario_id=3, db=db)

        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.ruta_almacenamiento == "casos/1/abc.pdf"
        assert added.caso_id == 1
        assert added.subido_por == 3

    def test_caso_inexistente_lanza_excepcion(self):
        db = MagicMock()
        db.get.return_value = None
        req = DocumentoRegisterRequest(
            object_key="casos/99/x.pdf",
            nombre_archivo="x.pdf",
            categoria=CategoriaDocumento.OTRO,
            formato=FormatoDocumento.PDF,
        )

        with pytest.raises(CasoNoEncontrado):
            register_documento(99, req, usuario_id=1, db=db)


# ── list_documentos ───────────────────────────────────────────────────────────


class TestListDocumentos:
    def test_retorna_lista_vacia_sin_documentos(self):
        db = MagicMock()
        from app.features.casos.models import Caso
        db.get.return_value = MagicMock(spec=Caso, id=1)
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        result = list_documentos(1, db)

        assert result == []

    def test_caso_inexistente_lanza_excepcion(self):
        db = MagicMock()
        db.get.return_value = None

        with pytest.raises(CasoNoEncontrado):
            list_documentos(999, db)


# ── get_download_url ──────────────────────────────────────────────────────────


class TestGetDownloadUrl:
    def test_retorna_url_de_descarga(self):
        from app.features.documentos.models import Documento

        doc = MagicMock(spec=Documento)
        doc.ruta_almacenamiento = "casos/1/abc.pdf"

        db = MagicMock()
        db.get.return_value = doc
        storage = _make_storage("https://download.url/file")

        result = get_download_url(1, storage, db)

        assert result.download_url == "https://download.url/file"
        assert result.expires_in == 3600
        storage.generate_presigned_url.assert_called_once_with(
            "get_object", "casos/1/abc.pdf", 3600
        )

    def test_documento_inexistente_lanza_excepcion(self):
        db = MagicMock()
        db.get.return_value = None
        storage = _make_storage()

        with pytest.raises(DocumentoNoEncontrado):
            get_download_url(999, storage, db)
