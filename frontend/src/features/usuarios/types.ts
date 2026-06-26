import type { Area, Rol } from '../../shared/types';

/** Usuario del estudio tal como lo devuelve el backend (sin password_hash). */
export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  area: Area | null;
  matricula: string | null;
  activo: boolean;
  creado_en: string;
}

/** Payload para crear un usuario nuevo (SOCIO provee la contraseña inicial). */
export interface UsuarioCreate {
  email: string;
  password: string;
  nombre: string;
  rol: Rol;
  area: Area | null;
  matricula: string | null;
}

/** Payload para editar nombre, rol, área y matrícula (sin email ni password). */
export interface UsuarioUpdate {
  nombre: string;
  rol: Rol;
  area: Area | null;
  matricula: string | null;
}

/** Payload para cambiar estado activo (baja/alta lógica). */
export interface UsuarioActivacion {
  activo: boolean;
}
