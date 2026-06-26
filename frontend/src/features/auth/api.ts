import { http } from '../../shared/http';
import type { Perfil } from './types';

export function login(email: string, password: string): Promise<Perfil> {
  return http.post<Perfil>('/auth/login', { email, password });
}

export function refresh(): Promise<Perfil> {
  return http.post<Perfil>('/auth/refresh');
}

export function logout(): Promise<void> {
  return http.post<void>('/auth/logout');
}
