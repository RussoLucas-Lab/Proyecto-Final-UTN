/**
 * Cliente HTTP del feature usuarios.
 *
 * Usa shared/http que ya inyecta:
 *   - credentials: 'include'  → cookies HttpOnly se envían automáticamente
 *   - X-CSRF-Token            → leído de la cookie csrf_token (double-submit)
 */
import { http } from '../../shared/http';
import type { Usuario, UsuarioActivacion, UsuarioCreate, UsuarioUpdate } from './types';

/** Lista todos los usuarios del estudio. */
export function listar(): Promise<Usuario[]> {
  return http.get<Usuario[]>('/usuarios');
}

/** Crea un usuario nuevo con contraseña inicial (solo SOCIO). */
export function crear(datos: UsuarioCreate): Promise<Usuario> {
  return http.post<Usuario>('/usuarios', datos);
}

/** Edita nombre, rol, área y matrícula de un usuario (solo SOCIO). */
export function editar(id: number, datos: UsuarioUpdate): Promise<Usuario> {
  return http.put<Usuario>(`/usuarios/${id}`, datos);
}

/** Activa o desactiva un usuario — baja lógica (solo SOCIO). */
export function cambiarActivacion(id: number, datos: UsuarioActivacion): Promise<Usuario> {
  return http.patch<Usuario>(`/usuarios/${id}`, datos);
}
