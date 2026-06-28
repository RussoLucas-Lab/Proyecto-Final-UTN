import { http } from '../../shared/http';
import type { DatosTelegrama, ResultadoTelegrama, Telegrama } from './types';

export function listarTelegramas(casoId: number): Promise<Telegrama[]> {
  return http.get(`/casos/${casoId}/telegramas`);
}

export function registrarTelegrama(casoId: number, datos: DatosTelegrama): Promise<Telegrama> {
  return http.post(`/casos/${casoId}/telegramas`, datos);
}

export function actualizarResultado(
  telegramaId: number,
  resultado: ResultadoTelegrama,
): Promise<Telegrama> {
  return http.patch(`/telegramas/${telegramaId}`, { resultado });
}

export function setResultadoTelegrama(
  casoId: number,
  numero: 1 | 2 | 3,
  resultado: ResultadoTelegrama,
): Promise<Telegrama> {
  return http.put(`/casos/${casoId}/telegramas/${numero}/resultado`, { resultado });
}
