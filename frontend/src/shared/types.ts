export type Rol = 'SOCIO' | 'ABOGADO';
export type Area = 'LABORAL' | 'ART';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: Rol;
  area?: Area;
  matricula?: string;
  activo: boolean;
}

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  cuil?: string;
  telefono?: string;
  email?: string;
  domicilio_real?: string;
  domicilio_real_cp?: string;
  domicilio_real_localidad?: string;
  domicilio_real_provincia?: string;
}

export interface Etapa {
  id: number;
  nombre: string;
  area: Area;
  orden: number;
  es_terminal: boolean;
}

export interface Caso {
  id: number;
  expediente: string;
  area: Area;
  etapa_actual: Etapa;
  cliente: Cliente;
  abogado: Usuario;
  fecha_inicio: string;
  ultimo_movimiento: string;
}

export interface Documento {
  id: number;
  nombre: string;
  tipo: string;
  url: string;
  subido_en: string;
}

export interface Vencimiento {
  id: number;
  descripcion: string;
  fecha: string;
  area?: Area;
}

export interface EntradaHistorial {
  id: number;
  descripcion: string;
  fecha: string;
  usuario: string;
}

export interface BorradorActualizacion {
  id: number;
  caso_id: number;
  cliente_nombre: string;
  area: Area;
  etapa: string;
  borrador: string;
  estado: 'PENDIENTE_REVISION' | 'APROBADO' | 'DESCARTADO';
}
