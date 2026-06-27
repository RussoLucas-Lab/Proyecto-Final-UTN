/**
 * Tipos del feature casos.
 *
 * Fuente de verdad: schemas Pydantic del backend (CasoResponse, CasoDetalleResponse, etc.)
 * Los nombres de etapa y transiciones vienen siempre del backend — nunca hardcodeados aquí.
 */

export type AreaDerecho = 'LABORAL' | 'ART';
export type TipoReclamoArt = 'ACCIDENTE' | 'ENFERMEDAD';
export type FaseCaso = 'EXTRAJUDICIAL' | 'JUDICIAL';

/** Etapa del catálogo configurable (ADR-0008 — estados como datos). */
export interface Etapa {
  id: number;
  area: AreaDerecho;
  fase: FaseCaso;
  nombre: string;
  orden: number;
  es_terminal: boolean;
}

/** Ficha laboral de admisión del caso (RF-09, 1:1 con Caso). */
export interface FichaLaboral {
  id: number;
  caso_id: number;
  empleador_nombre: string | null;
  ramo_actividad: string | null;
  direccion_trabajo: string | null;
  direccion_trabajo_cp: string | null;
  direccion_trabajo_localidad: string | null;
  direccion_trabajo_provincia: string | null;
  razon_social: string | null;
  motivo_cese: string | null;
  fecha_inicio_laboral: string | null;
  jornada: string | null;
  tareas: string | null;
  remuneracion: string | null;
  cct_aplicable: string | null;
  registrado: boolean | null;
  fecha_alta: string | null;
  sueldo_coincide_bono: boolean | null;
  jornada_coincide_bono: boolean | null;
  estado_aportes: string | null;
  accidentes: string | null;
  enfermedades: string | null;
  notas: string | null;
}

/** Resumen del caso — usado en listado (CasoResponse del backend). */
export interface Caso {
  id: number;
  cliente_id: number;
  cliente_nombre: string | null;
  abogado_responsable_id: number;
  area: AreaDerecho;
  tipo_reclamo: TipoReclamoArt | null;
  codigo_expediente: string | null;
  etapa_actual_id: number;
  etapa_actual_nombre: string | null;
  fecha_inicio: string | null;
  observaciones: string | null;
  creado_en: string;
}

/** Detalle completo del caso con etapa, ficha y transiciones válidas. */
export interface CasoDetalle extends Caso {
  etapa_actual: Etapa;
  ficha: FichaLaboral | null;
  transiciones_validas: Etapa[];
}

/** Payload para crear un caso nuevo (RF-08). */
export interface CasoCreate {
  cliente_id: number;
  abogado_responsable_id: number;
  area: AreaDerecho;
  tipo_reclamo?: TipoReclamoArt | null;
  codigo_expediente?: string | null;
  fecha_inicio?: string | null;
  observaciones?: string | null;
  ficha_laboral?: FichaLaboralUpsert | null;
}

/** Payload para crear o actualizar la ficha laboral (RF-09). */
export interface FichaLaboralUpsert {
  empleador_nombre?: string | null;
  ramo_actividad?: string | null;
  direccion_trabajo?: string | null;
  direccion_trabajo_cp?: string | null;
  direccion_trabajo_localidad?: string | null;
  direccion_trabajo_provincia?: string | null;
  razon_social?: string | null;
  motivo_cese?: string | null;
  fecha_inicio_laboral?: string | null;
  jornada?: string | null;
  tareas?: string | null;
  remuneracion?: string | null;
  cct_aplicable?: string | null;
  registrado?: boolean | null;
  fecha_alta?: string | null;
  sueldo_coincide_bono?: boolean | null;
  jornada_coincide_bono?: boolean | null;
  estado_aportes?: string | null;
  accidentes?: string | null;
  enfermedades?: string | null;
  notas?: string | null;
}

/** Entrada del historial inmutable del caso (RN-05, RN-06). */
export interface HistorialItem {
  id: number;
  caso_id: number;
  etapa_anterior_id: number | null;
  etapa_nueva_id: number;
  evento: string;
  autor_id: number;
  ocurrido_en: string;
}
