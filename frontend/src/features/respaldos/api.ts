/**
 * Llamadas a la API de la feature respaldos.
 * Usa el cliente HTTP compartido (credentials + CSRF automáticos).
 */

import { http } from '../../shared/http';
import type { DescargarRespaldoResponse, Respaldo, TriggerRespaldoResponse } from './types';

/**
 * Lista el historial de respaldos ordenado por fecha DESC.
 * GET /api/v1/backups
 * Requiere rol SOCIO (cookie JWT).
 */
export function listarRespaldos(): Promise<Respaldo[]> {
  return http.get<Respaldo[]>('/backups');
}

/**
 * Dispara un respaldo manual vía n8n WF-02.
 * POST /api/v1/backups
 * Requiere rol SOCIO + CSRF (header X-CSRF-Token incluido automáticamente por http.post).
 * Devuelve 202 Accepted con un mensaje de confirmación.
 */
export function triggerRespaldoManual(): Promise<TriggerRespaldoResponse> {
  return http.post<TriggerRespaldoResponse>('/backups');
}

/**
 * Obtiene una URL prefirmada para descargar el Excel de un respaldo.
 * GET /api/v1/backups/{id}/download
 * Requiere rol SOCIO (cookie JWT).
 */
export function descargarRespaldo(id: number): Promise<DescargarRespaldoResponse> {
  return http.get<DescargarRespaldoResponse>(`/backups/${id}/download`);
}
