export type CategoriaDocumento = 'DNI' | 'BONO_SUELDO' | 'HISTORIA_CLINICA' | 'ACTA_NOTARIAL' | 'PODER' | 'OTRO';
export type FormatoDocumento = 'PDF' | 'DOC' | 'IMAGEN';

export interface DocumentoInitResponse {
  upload_url: string;
  object_key: string;
  expires_in: number;
}

export interface DocumentoResponse {
  id: number;
  caso_id: number;
  nombre_archivo: string;
  categoria: CategoriaDocumento;
  formato: FormatoDocumento;
  object_key: string;
  subido_por: number;
  subido_en: string;
}

export interface DocumentoDownloadResponse {
  download_url: string;
  expires_in: number;
}
