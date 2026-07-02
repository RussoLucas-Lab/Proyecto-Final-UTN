export interface VencimientoCreate {
  descripcion: string;
  fecha: string; // YYYY-MM-DD
}

export interface VencimientoResponse {
  id: number;
  caso_id: number;
  descripcion: string;
  fecha: string; // YYYY-MM-DD
  completado: boolean;
  creado_por: number | null;
  creado_en: string;
}

export interface VencimientoAgendaItem extends VencimientoResponse {
  area_caso: string; // "LABORAL" | "ART"
  cliente_nombre: string;
}
