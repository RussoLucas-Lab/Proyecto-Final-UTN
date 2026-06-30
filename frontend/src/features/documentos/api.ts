import { http } from '../../shared/http';
import type {
  CategoriaDocumento,
  DocumentoDownloadResponse,
  DocumentoInitResponse,
  DocumentoResponse,
  FormatoDocumento,
} from './types';

export function initUpload(
  casoId: number,
  payload: { nombre_archivo: string; categoria: CategoriaDocumento; formato: FormatoDocumento },
): Promise<DocumentoInitResponse> {
  return http.post<DocumentoInitResponse>(`/casos/${casoId}/documentos:init`, payload);
}

export function registerDocumento(
  casoId: number,
  payload: { object_key: string; nombre_archivo: string; categoria: CategoriaDocumento; formato: FormatoDocumento },
): Promise<DocumentoResponse> {
  return http.post<DocumentoResponse>(`/casos/${casoId}/documentos`, payload);
}

export function listDocumentos(casoId: number): Promise<DocumentoResponse[]> {
  return http.get<DocumentoResponse[]>(`/casos/${casoId}/documentos`);
}

export function getDownloadUrl(documentoId: number): Promise<DocumentoDownloadResponse> {
  return http.get<DocumentoDownloadResponse>(`/documentos/${documentoId}/url`);
}

/** PUT directo al storage — sin headers de auth ni CSRF (la firma S3 ya autentica). */
export async function uploadToStorage(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!res.ok) {
    throw new Error(`Error al subir el archivo: ${res.status}`);
  }
}
