/** Cliente del estudio tal como lo devuelve el backend. */
export interface Cliente {
  id: number;
  nombre: string;
  dni: string;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  domicilio_real: string | null;
  domicilio_real_cp: string | null;
  domicilio_real_localidad: string | null;
  domicilio_real_provincia: string | null;
  domicilio_coincide_dni: boolean | null;
  creado_en: string;
}

/** Payload para crear un cliente nuevo (admisión). */
export interface ClienteCreate {
  nombre: string;
  dni: string;
  cuil?: string | null;
  telefono?: string | null;
  email?: string | null;
  domicilio_real?: string | null;
  domicilio_real_cp?: string | null;
  domicilio_real_localidad?: string | null;
  domicilio_real_provincia?: string | null;
  domicilio_coincide_dni?: boolean | null;
}

/** Payload para editar un cliente (todos los campos editables, dni incluido). */
export interface ClienteUpdate {
  nombre: string;
  dni: string;
  cuil?: string | null;
  telefono?: string | null;
  email?: string | null;
  domicilio_real?: string | null;
  domicilio_real_cp?: string | null;
  domicilio_real_localidad?: string | null;
  domicilio_real_provincia?: string | null;
  domicilio_coincide_dni?: boolean | null;
}
