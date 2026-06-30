from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.shared.enums import CategoriaDocumento, FormatoDocumento


class DocumentoInitRequest(BaseModel):
    nombre_archivo: str
    categoria: CategoriaDocumento
    formato: FormatoDocumento


class DocumentoInitResponse(BaseModel):
    upload_url: str
    object_key: str
    expires_in: int


class DocumentoRegisterRequest(BaseModel):
    object_key: str
    nombre_archivo: str
    categoria: CategoriaDocumento
    formato: FormatoDocumento


class DocumentoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    caso_id: int
    nombre_archivo: str
    categoria: CategoriaDocumento
    formato: FormatoDocumento
    # ruta_almacenamiento en ORM → object_key en el contrato público (D3)
    object_key: str = Field(validation_alias="ruta_almacenamiento")
    subido_por: int
    subido_en: datetime


class DocumentoDownloadResponse(BaseModel):
    download_url: str
    expires_in: int
