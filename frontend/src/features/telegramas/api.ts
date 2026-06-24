import { http } from '../../shared/http';
import type { DatosTelegrama, ResultadoTelegrama, Telegrama } from './types';

export function registrarTelegrama(casoId: number, datos: DatosTelegrama): Promise<Telegrama> {
  return http.post(`/casos/${casoId}/telegramas`, datos);
}

export function actualizarResultado(
  telegramaId: number,
  resultado: ResultadoTelegrama,
): Promise<Telegrama> {
  return http.patch(`/telegramas/${telegramaId}`, { resultado });
}
