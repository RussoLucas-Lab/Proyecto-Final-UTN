/**
 * Cliente HTTP del feature clientes.
 *
 * Usa shared/http que ya inyecta:
 *   - credentials: 'include'  → cookies HttpOnly se envían automáticamente
 *   - X-CSRF-Token            → leído de la cookie csrf_token (double-submit)
 */
import { http } from '../../shared/http';
import type { Cliente, ClienteCreate, ClienteUpdate } from './types';

/** Lista clientes con búsqueda y paginación opcionales. */
export function listar(params?: { search?: string; page?: number }): Promise<Cliente[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.page !== undefined) qs.set('page', String(params.page));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return http.get<Cliente[]>(`/clientes${query}`);
}

/** Obtiene un cliente por id. */
export function obtener(id: number): Promise<Cliente> {
  return http.get<Cliente>(`/clientes/${id}`);
}

/** Crea un cliente nuevo (admisión). */
export function crear(datos: ClienteCreate): Promise<Cliente> {
  return http.post<Cliente>('/clientes', datos);
}

/** Edita los datos de un cliente. */
export function editar(id: number, datos: ClienteUpdate): Promise<Cliente> {
  return http.put<Cliente>(`/clientes/${id}`, datos);
}
