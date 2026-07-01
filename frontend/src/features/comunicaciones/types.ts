/**
 * Tipos de la feature comunicaciones, alineados a los schemas del backend.
 *
 * Flujo individual (WF-01): ActualizacionResponse mapea `contenido` -> `borrador`.
 * Flujo batch (WF-05, RF-26): BorradorPendienteResponse mapea `contenido` -> `preview`.
 * Estado siempre PENDIENTE_REVISION al generarse; el envío al cliente es manual (RN-10).
 */

export type EstadoComunicacion = 'PENDIENTE_REVISION' | 'APROBADO' | 'DESCARTADO';

export interface Actualizacion {
  id: number;
  borrador: string;
  generado_en: string;
}

export interface Borrador {
  texto: string;
  estado: EstadoComunicacion;
}

/**
 * Borrador de revisión del batch (GET /comunicaciones), espejo de
 * BorradorPendienteResponse. `area`/`etapa` vienen del backend — no hardcodear.
 */
export interface BorradorPendiente {
  id: number;
  caso_id: number;
  cliente: string;
  area: string;
  etapa: string;
  preview: string;
  estado: EstadoComunicacion;
  generado_en: string;
}

/** Respuesta de PATCH /comunicaciones/{id} (aprobar/descartar). */
export interface ComunicacionRevisada {
  id: number;
  estado: EstadoComunicacion;
  aprobado_por: number | null;
  aprobado_en: string | null;
}
