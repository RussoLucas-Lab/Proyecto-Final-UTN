/**
 * Cliente HTTP de la feature comunicaciones.
 *
 * Usa shared/http que ya inyecta:
 *   - credentials: 'include'  → cookie JWT HttpOnly se envía automáticamente
 *   - X-CSRF-Token            → leído de la cookie csrf_token (double-submit)
 *
 * No llama a n8n ni a OpenAI directamente (ADR-0003).
 */
import { http } from '../../shared/http';
import type { Actualizacion, BorradorPendiente, ComunicacionRevisada, EstadoComunicacion } from './types';

/**
 * Dispara la generación del borrador de actualización para el caso (RF-16).
 *
 * POST /api/v1/casos/{casoId}/actualizacion
 * - 200: Actualizacion { id, borrador, generado_en }
 * - 503: servicio de IA no disponible → lanza un error con status 503
 *
 * El borrador persiste en estado PENDIENTE_REVISION. Nada se envía al cliente (RN-10).
 */
export async function generarActualizacion(casoId: number): Promise<Actualizacion> {
  return http.post<Actualizacion>(`/casos/${casoId}/actualizacion`);
}

/**
 * Lista los borradores del batch (WF-05) para revisión (RF-26.4).
 *
 * GET /api/v1/comunicaciones?estado={estado}
 * - 200: BorradorPendiente[] { id, caso_id, cliente, area, etapa, preview, estado, generado_en }
 *
 * Por defecto trae los PENDIENTE_REVISION (los que hay que revisar hoy).
 */
export async function listarPendientes(
  estado: EstadoComunicacion = 'PENDIENTE_REVISION',
): Promise<BorradorPendiente[]> {
  return http.get<BorradorPendiente[]>(`/comunicaciones?estado=${encodeURIComponent(estado)}`);
}

/**
 * Aprueba o descarta un borrador (RF-26.4, D4).
 *
 * PATCH /api/v1/comunicaciones/{id}
 * - 200: ComunicacionRevisada { id, estado, aprobado_por, aprobado_en }
 *
 * Aprobar reinicia la ventana de cadencia de 15 días del caso. Nunca envía
 * nada al cliente — el envío por WhatsApp lo hace el abogado a mano (RN-10).
 */
export async function revisarComunicacion(
  id: number,
  estado: Extract<EstadoComunicacion, 'APROBADO' | 'DESCARTADO'>,
): Promise<ComunicacionRevisada> {
  return http.patch<ComunicacionRevisada>(`/comunicaciones/${id}`, { estado });
}
