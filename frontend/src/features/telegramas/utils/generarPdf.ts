import { PDFDocument } from 'pdf-lib';
import type { TipoComunicacion, ClienteTelegrama, FichaLaboralTelegrama } from '../types';

export const PALABRAS_MINIMAS = 30;

// Mapeo del enum de dominio al valor exacto del radio group del PDF oficial
const RADIO_OPCIONES: Record<TipoComunicacion, string> = {
  RENUNCIA: 'Opción1',
  AUSENCIA: 'Opción2',
  OTRO: 'Opción3',
};

export interface DatosParaPdf {
  ficha: FichaLaboralTelegrama;
  cliente: ClienteTelegrama;
  cuerpo: string;
  tipo_comunicacion: TipoComunicacion;
  fecha?: string;
}

// Escribe un campo de texto usando el nombre EXACTO del PDF; si no existe en esta
// versión del formulario registra un aviso en consola y continúa.
function setTextField(form: ReturnType<PDFDocument['getForm']>, name: string, value: string): void {
  try {
    form.getTextField(name).setText(value || '');
  } catch {
    console.warn(`[telegrama] Campo de texto no encontrado en el PDF: "${name}"`);
  }
}

export async function generarPdfTelegrama(
  pdfBytes: ArrayBuffer,
  datos: DatosParaPdf,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();

  const { ficha, cliente, cuerpo, tipo_comunicacion } = datos;
  const fecha = datos.fecha ?? new Date().toLocaleDateString('es-AR');

  // ── Bloque destinatario (empleador) ──────────────────────────────────────
  setTextField(form, 'Apellido y nombre o razón social', ficha.razon_social ?? ficha.empleador_nombre ?? '');
  setTextField(form, 'Ramo o actividad principal',       ficha.ramo_actividad ?? '');
  setTextField(form, 'Domicilio laboral',                ficha.direccion_trabajo ?? '');
  setTextField(form, 'CP',                               ficha.direccion_trabajo_cp ?? '');
  setTextField(form, 'Localidad',                        ficha.direccion_trabajo_localidad ?? '');
  setTextField(form, 'Provincia',                        ficha.direccion_trabajo_provincia ?? '');

  // ── Bloque remitente (trabajador) ─────────────────────────────────────────
  setTextField(form, 'Apellido y nombre REMITENTE', cliente.nombre);
  setTextField(form, 'N° DNI REMITENTE',            cliente.dni);
  setTextField(form, 'Fecha',                        fecha);
  setTextField(form, 'Domicilio real',               cliente.domicilio_real ?? '');
  setTextField(form, 'CP REMITENTE',                 cliente.domicilio_real_cp ?? '');
  setTextField(form, 'Localidad REMITENTE',          cliente.domicilio_real_localidad ?? '');
  setTextField(form, 'Provincia REMITENTE',          cliente.domicilio_real_provincia ?? '');

  // ── Bloque texto del reclamo ──────────────────────────────────────────────
  setTextField(form, 'Campo de texto', cuerpo);

  // ── Radio group tipo de comunicación ─────────────────────────────────────
  try {
    form.getRadioGroup('Opciones de comunicación').select(RADIO_OPCIONES[tipo_comunicacion]);
  } catch {
    console.warn('[telegrama] Radio group "Opciones de comunicación" no encontrado en el PDF');
  }

  return doc.save();
}

export function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}
