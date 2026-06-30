import { http } from '../../shared/http';
import type { VencimientoCreate, VencimientoResponse } from './types';

export function crearVencimiento(casoId: number, payload: VencimientoCreate): Promise<VencimientoResponse> {
  return http.post(`/casos/${casoId}/vencimientos`, payload);
}

export function listarVencimientosCaso(casoId: number): Promise<VencimientoResponse[]> {
  return http.get(`/casos/${casoId}/vencimientos`);
}

export function listarVencimientosRango(desde: string, hasta: string): Promise<VencimientoResponse[]> {
  return http.get(`/vencimientos?desde=${desde}&hasta=${hasta}`);
}

export function completarVencimiento(id: number, completado: boolean): Promise<VencimientoResponse> {
  return http.patch(`/vencimientos/${id}`, { completado });
}
