export type TipoComunicacion = 'RENUNCIA' | 'AUSENCIA' | 'OTRO';
export type ResultadoTelegrama =
  | 'PENDIENTE'
  | 'ENTREGADO'
  | 'RECHAZADO'
  | 'EN_SUCURSAL'
  | 'DOMICILIO_INEXISTENTE'
  | 'CERRADO';

export interface FichaLaboralTelegrama {
  razon_social: string | null;
  empleador_nombre: string | null;
  ramo_actividad: string | null;
  direccion_trabajo: string | null;
  direccion_trabajo_cp: string | null;
  direccion_trabajo_localidad: string | null;
  direccion_trabajo_provincia: string | null;
}

export interface ClienteTelegrama {
  nombre: string;
  dni: string;
  domicilio_real: string | null;
  domicilio_real_cp: string | null;
  domicilio_real_localidad: string | null;
  domicilio_real_provincia: string | null;
}

export interface DatosTelegrama {
  numero: 1 | 2 | 3;
  tipo_comunicacion: TipoComunicacion;
  cuerpo: string;
  destinatario: string;
  domicilio_destino: string;
}

export interface Telegrama {
  id: number;
  caso_id: number;
  numero: 1 | 2 | 3;
  resultado: ResultadoTelegrama;
  tipo_comunicacion: TipoComunicacion;
  destinatario: string | null;
  domicilio_destino: string | null;
  cuerpo: string | null;
  codigo_seguimiento: string | null;
  fecha_envio: string | null;
  fecha_resultado: string | null;
}
