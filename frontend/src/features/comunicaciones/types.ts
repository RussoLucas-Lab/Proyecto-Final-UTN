/**
 * Tipos de la feature comunicaciones, alineados a ActualizacionResponse del backend.
 *
 * El backend mapea el campo ORM `contenido` al campo JSON `borrador`.
 * Estado siempre PENDIENTE_REVISION tras la generación individual (RN-10).
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
