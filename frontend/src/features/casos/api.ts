/**
 * Cliente HTTP del feature casos.
 *
 * Usa shared/http que ya inyecta:
 *   - credentials: 'include'  → cookies HttpOnly se envían automáticamente
 *   - X-CSRF-Token            → leído de la cookie csrf_token (double-submit)
 */
import { http } from '../../shared/http';
import type {
  AreaDerecho,
  Caso,
  CasoCreate,
  CasoDetalle,
  Etapa,
  FichaLaboral,
  FichaLaboralUpsert,
  HistorialItem,
} from './types';

/** Lista casos con filtros opcionales y paginación (RF-13, D9). */
export function listar(params?: {
  area?: AreaDerecho;
  etapa_id?: number;
  abogado_id?: number;
  cliente_id?: number;
  page?: number;
}): Promise<Caso[]> {
  const qs = new URLSearchParams();
  if (params?.area) qs.set('area', params.area);
  if (params?.etapa_id !== undefined) qs.set('etapa_id', String(params.etapa_id));
  if (params?.abogado_id !== undefined) qs.set('abogado_id', String(params.abogado_id));
  if (params?.cliente_id !== undefined) qs.set('cliente_id', String(params.cliente_id));
  if (params?.page !== undefined) qs.set('page', String(params.page));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return http.get<Caso[]>(`/casos${query}`);
}

/** Obtiene el detalle de un caso (con etapa_actual, ficha y transiciones_validas). */
export function obtener(id: number): Promise<CasoDetalle> {
  return http.get<CasoDetalle>(`/casos/${id}`);
}

/** Crea un caso nuevo (RF-08, RF-09). */
export function crear(datos: CasoCreate): Promise<Caso> {
  return http.post<Caso>('/casos', datos);
}

/** Crea o actualiza la ficha laboral de un caso (RF-09). */
export function upsertFicha(casoId: number, datos: FichaLaboralUpsert): Promise<FichaLaboral> {
  return http.put<FichaLaboral>(`/casos/${casoId}/ficha-laboral`, datos);
}

/** Avanza el caso a la etapa destino (RF-10, RN-04). */
export function avanzar(casoId: number, etapaDestinoId: number): Promise<Caso> {
  return http.post<Caso>(`/casos/${casoId}/avanzar`, { etapa_destino_id: etapaDestinoId });
}

/**
 * Retrocede el caso a la etapa destino (RF-11, RN-09).
 *
 * Cuando el caso está en etapa terminal, requiere confirmar=true.
 * Sin confirmación el backend responde 409.
 */
export function retroceder(
  casoId: number,
  etapaDestinoId: number,
  confirmar: boolean = false,
): Promise<Caso> {
  return http.post<Caso>(`/casos/${casoId}/retroceder`, {
    etapa_destino_id: etapaDestinoId,
    confirmar,
  });
}

/** Obtiene el historial cronológico e inmutable del caso (RF-12, RN-06). */
export function historial(casoId: number): Promise<HistorialItem[]> {
  return http.get<HistorialItem[]>(`/casos/${casoId}/historial`);
}

/** Catálogo de etapas del área ordenadas por orden (ADR-0008). */
export function listarEtapas(area: AreaDerecho): Promise<Etapa[]> {
  return http.get<Etapa[]>(`/casos/etapas?area=${area}`);
}
