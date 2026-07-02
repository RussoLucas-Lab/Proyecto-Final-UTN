/**
 * Tipos de la feature respaldos.
 * Espejo del BackupResponse del backend (RF-21, RF-22).
 */

export type TipoRespaldo = 'AUTOMATICO' | 'MANUAL';
export type EstadoRespaldo = 'OK' | 'ERROR';

export interface Respaldo {
  id: number;
  /** ISO 8601 datetime string */
  fecha: string;
  tipo: TipoRespaldo;
  estado: EstadoRespaldo;
  ubicacion: string | null;
}

export interface TriggerRespaldoResponse {
  mensaje: string;
}

export interface DescargarRespaldoResponse {
  download_url: string;
  expires_in: number;
}
