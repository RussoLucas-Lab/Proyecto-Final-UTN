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
