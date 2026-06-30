from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.storage import StorageClient
from app.features.casos.models import Caso
from app.features.documentos.models import Documento
from app.features.documentos.schemas import (
    DocumentoDownloadResponse,
    DocumentoInitRequest,
    DocumentoInitResponse,
    DocumentoRegisterRequest,
)
from app.shared.enums import FormatoDocumento

_EXPIRES_UPLOAD = 300
_EXPIRES_DOWNLOAD = 3600

_EXT: dict[FormatoDocumento, str] = {
    FormatoDocumento.PDF: "pdf",
    FormatoDocumento.DOC: "doc",
    FormatoDocumento.IMAGEN: "jpg",
}


class CasoNoEncontrado(Exception):
    pass


class DocumentoNoEncontrado(Exception):
    pass


def init_upload(
    caso_id: int,
    request: DocumentoInitRequest,
    storage: StorageClient,
    db: Session,
) -> DocumentoInitResponse:
    if db.get(Caso, caso_id) is None:
        raise CasoNoEncontrado(f"Caso {caso_id} no encontrado")

    ext = _EXT[request.formato]
    object_key = f"casos/{caso_id}/{uuid4()}.{ext}"
    upload_url = storage.generate_presigned_url("put_object", object_key, _EXPIRES_UPLOAD)

    return DocumentoInitResponse(
        upload_url=upload_url,
        object_key=object_key,
        expires_in=_EXPIRES_UPLOAD,
    )


def register_documento(
    caso_id: int,
    request: DocumentoRegisterRequest,
    usuario_id: int,
    db: Session,
) -> Documento:
    if db.get(Caso, caso_id) is None:
        raise CasoNoEncontrado(f"Caso {caso_id} no encontrado")

    doc = Documento(
        caso_id=caso_id,
        categoria=request.categoria,
        formato=request.formato,
        nombre_archivo=request.nombre_archivo,
        ruta_almacenamiento=request.object_key,
        subido_por=usuario_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def list_documentos(caso_id: int, db: Session) -> list[Documento]:
    if db.get(Caso, caso_id) is None:
        raise CasoNoEncontrado(f"Caso {caso_id} no encontrado")

    return (
        db.query(Documento)
        .filter(Documento.caso_id == caso_id)
        .order_by(Documento.subido_en.desc())
        .all()
    )


def get_download_url(
    documento_id: int,
    storage: StorageClient,
    db: Session,
) -> DocumentoDownloadResponse:
    doc = db.get(Documento, documento_id)
    if doc is None:
        raise DocumentoNoEncontrado(f"Documento {documento_id} no encontrado")

    download_url = storage.generate_presigned_url(
        "get_object", doc.ruta_almacenamiento, _EXPIRES_DOWNLOAD
    )
    return DocumentoDownloadResponse(download_url=download_url, expires_in=_EXPIRES_DOWNLOAD)
