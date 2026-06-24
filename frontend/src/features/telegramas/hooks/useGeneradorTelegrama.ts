import { useState, useCallback } from 'react';
import { generarPdfTelegrama, contarPalabras, PALABRAS_MINIMAS } from '../utils/generarPdf';
import { registrarTelegrama } from '../api';
import type { TipoComunicacion, ClienteTelegrama, FichaLaboralTelegrama } from '../types';

interface Params {
  casoId: number;
  pdfUrl: string;
  cliente: ClienteTelegrama;
  ficha: FichaLaboralTelegrama;
}

interface FormTelegrama {
  numero: 1 | 2 | 3;
  tipo_comunicacion: TipoComunicacion;
  cuerpo: string;
  destinatario: string;
  domicilio_destino: string;
  // Campos editables del destinatario
  razon_social: string;
  ramo_actividad: string;
  direccion_trabajo: string;
  direccion_trabajo_cp: string;
  direccion_trabajo_localidad: string;
  direccion_trabajo_provincia: string;
  // Campos editables del remitente
  nombre_remitente: string;
  dni_remitente: string;
  domicilio_real: string;
  domicilio_real_cp: string;
  domicilio_real_localidad: string;
  domicilio_real_provincia: string;
}

function buildForm(cliente: ClienteTelegrama, ficha: FichaLaboralTelegrama): FormTelegrama {
  return {
    numero: 1,
    tipo_comunicacion: 'OTRO',
    cuerpo: '',
    destinatario: ficha.razon_social ?? ficha.empleador_nombre ?? '',
    domicilio_destino: ficha.direccion_trabajo ?? '',
    razon_social: ficha.razon_social ?? ficha.empleador_nombre ?? '',
    ramo_actividad: ficha.ramo_actividad ?? '',
    direccion_trabajo: ficha.direccion_trabajo ?? '',
    direccion_trabajo_cp: ficha.direccion_trabajo_cp ?? '',
    direccion_trabajo_localidad: ficha.direccion_trabajo_localidad ?? '',
    direccion_trabajo_provincia: ficha.direccion_trabajo_provincia ?? '',
    nombre_remitente: cliente.nombre,
    dni_remitente: cliente.dni,
    domicilio_real: cliente.domicilio_real ?? '',
    domicilio_real_cp: cliente.domicilio_real_cp ?? '',
    domicilio_real_localidad: cliente.domicilio_real_localidad ?? '',
    domicilio_real_provincia: cliente.domicilio_real_provincia ?? '',
  };
}

export function useGeneradorTelegrama({ casoId, pdfUrl, cliente, ficha }: Params) {
  const [form, setForm] = useState<FormTelegrama>(() => buildForm(cliente, ficha));
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advertenciaPalabras =
    form.cuerpo.trim().length > 0 && contarPalabras(form.cuerpo) < PALABRAS_MINIMAS;

  const actualizar = useCallback(
    <K extends keyof FormTelegrama>(campo: K, valor: FormTelegrama[K]) => {
      setForm((prev) => ({ ...prev, [campo]: valor }));
    },
    [],
  );

  const descargar = useCallback(async () => {
    setGenerando(true);
    setError(null);
    try {
      const res = await fetch(pdfUrl);
      const pdfBytes = await res.arrayBuffer();
      const bytes = await generarPdfTelegrama(pdfBytes, {
        ficha: {
          razon_social: form.razon_social || null,
          empleador_nombre: null,
          ramo_actividad: form.ramo_actividad || null,
          direccion_trabajo: form.direccion_trabajo || null,
          direccion_trabajo_cp: form.direccion_trabajo_cp || null,
          direccion_trabajo_localidad: form.direccion_trabajo_localidad || null,
          direccion_trabajo_provincia: form.direccion_trabajo_provincia || null,
        },
        cliente: {
          nombre: form.nombre_remitente,
          dni: form.dni_remitente,
          domicilio_real: form.domicilio_real || null,
          domicilio_real_cp: form.domicilio_real_cp || null,
          domicilio_real_localidad: form.domicilio_real_localidad || null,
          domicilio_real_provincia: form.domicilio_real_provincia || null,
        },
        cuerpo: form.cuerpo,
        tipo_comunicacion: form.tipo_comunicacion,
      });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telegrama_${form.numero}_${form.nombre_remitente.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo generar el PDF. Intentá de nuevo.');
    } finally {
      setGenerando(false);
    }
  }, [pdfUrl, form]);

  const guardarYRegistrar = useCallback(async () => {
    setGuardando(true);
    setError(null);
    try {
      await registrarTelegrama(casoId, {
        numero: form.numero,
        tipo_comunicacion: form.tipo_comunicacion,
        cuerpo: form.cuerpo,
        destinatario: form.destinatario,
        domicilio_destino: form.domicilio_destino,
      });
    } catch {
      setError('No se pudo registrar el telegrama. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }, [casoId, form]);

  return {
    form,
    actualizar,
    advertenciaPalabras,
    generando,
    guardando,
    error,
    descargar,
    guardarYRegistrar,
  };
}
