import React from 'react';
import { useGeneradorTelegrama } from '../hooks/useGeneradorTelegrama';
import { PALABRAS_MINIMAS } from '../utils/generarPdf';
import type { ClienteTelegrama, FichaLaboralTelegrama, TipoComunicacion } from '../types';

interface Props {
  casoId: number;
  pdfUrl: string;
  cliente: ClienteTelegrama;
  ficha: FichaLaboralTelegrama;
}

const TIPO_COMUNICACION_LABELS: Record<TipoComunicacion, string> = {
  RENUNCIA: 'Comunicación de renuncia',
  AUSENCIA: 'Comunicación de ausencia',
  OTRO: 'Otro tipo de comunicación',
};

export function GeneradorTelegrama({ casoId, pdfUrl, cliente, ficha }: Props) {
  const {
    form,
    actualizar,
    advertenciaPalabras,
    generando,
    guardando,
    error,
    descargar,
    guardarYRegistrar,
  } = useGeneradorTelegrama({ casoId, pdfUrl, cliente, ficha });

  return (
    <div>
      <h2>Generar telegrama (Ley 23.789)</h2>

      {error && <p role="alert">{error}</p>}

      <fieldset>
        <legend>Datos del telegrama</legend>

        <label>
          Número de telegrama
          <select
            value={form.numero}
            onChange={(e) => actualizar('numero', Number(e.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>

        <fieldset>
          <legend>Tipo de comunicación</legend>
          {(Object.keys(TIPO_COMUNICACION_LABELS) as TipoComunicacion[]).map((tipo) => (
            <label key={tipo}>
              <input
                type="radio"
                name="tipo_comunicacion"
                value={tipo}
                checked={form.tipo_comunicacion === tipo}
                onChange={() => actualizar('tipo_comunicacion', tipo)}
              />
              {TIPO_COMUNICACION_LABELS[tipo]}
            </label>
          ))}
        </fieldset>
      </fieldset>

      <fieldset>
        <legend>Destinatario (empleador)</legend>

        <label>
          Apellido y nombre o razón social
          <input
            type="text"
            value={form.razon_social}
            onChange={(e) => actualizar('razon_social', e.target.value)}
          />
        </label>

        <label>
          Ramo o actividad principal
          <input
            type="text"
            value={form.ramo_actividad}
            onChange={(e) => actualizar('ramo_actividad', e.target.value)}
          />
        </label>

        <label>
          Domicilio laboral
          <input
            type="text"
            value={form.direccion_trabajo}
            onChange={(e) => actualizar('direccion_trabajo', e.target.value)}
          />
        </label>

        <label>
          CP
          <input
            type="text"
            value={form.direccion_trabajo_cp}
            onChange={(e) => actualizar('direccion_trabajo_cp', e.target.value)}
          />
        </label>

        <label>
          Localidad
          <input
            type="text"
            value={form.direccion_trabajo_localidad}
            onChange={(e) => actualizar('direccion_trabajo_localidad', e.target.value)}
          />
        </label>

        <label>
          Provincia
          <input
            type="text"
            value={form.direccion_trabajo_provincia}
            onChange={(e) => actualizar('direccion_trabajo_provincia', e.target.value)}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Remitente (trabajador)</legend>

        <label>
          Apellido y nombre
          <input
            type="text"
            value={form.nombre_remitente}
            onChange={(e) => actualizar('nombre_remitente', e.target.value)}
          />
        </label>

        <label>
          N° DNI
          <input
            type="text"
            value={form.dni_remitente}
            onChange={(e) => actualizar('dni_remitente', e.target.value)}
          />
        </label>

        <label>
          Domicilio real
          <input
            type="text"
            value={form.domicilio_real}
            onChange={(e) => actualizar('domicilio_real', e.target.value)}
          />
        </label>

        <label>
          CP
          <input
            type="text"
            value={form.domicilio_real_cp}
            onChange={(e) => actualizar('domicilio_real_cp', e.target.value)}
          />
        </label>

        <label>
          Localidad
          <input
            type="text"
            value={form.domicilio_real_localidad}
            onChange={(e) => actualizar('domicilio_real_localidad', e.target.value)}
          />
        </label>

        <label>
          Provincia
          <input
            type="text"
            value={form.domicilio_real_provincia}
            onChange={(e) => actualizar('domicilio_real_provincia', e.target.value)}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Texto del reclamo</legend>

        <label>
          Mensaje
          <textarea
            value={form.cuerpo}
            onChange={(e) => actualizar('cuerpo', e.target.value)}
            rows={6}
          />
        </label>

        {advertenciaPalabras && (
          <p role="status">
            Este formato está pensado para mensajes de más de {PALABRAS_MINIMAS} palabras. El texto
            actual es más corto — podés continuar, pero revisá el resultado en el PDF.
          </p>
        )}
      </fieldset>

      <div>
        <button type="button" onClick={descargar} disabled={generando}>
          {generando ? 'Generando…' : 'Descargar PDF'}
        </button>

        <button type="button" onClick={guardarYRegistrar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar en el caso'}
        </button>
      </div>
    </div>
  );
}
