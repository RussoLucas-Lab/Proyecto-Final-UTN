/**
 * TelegramaPage — Generador de telegrama obrero (Ley 23.789).
 *
 * ASSET REQUERIDO — PDF OFICIAL:
 * ─────────────────────────────────────────────────────────────────────────────
 * Colocar el formulario oficial rellenable en:
 *   frontend/telegrama-oficial.pdf
 * (junto a index.html, en la raíz del proyecto frontend)
 * Vite sirve los archivos de esa carpeta como assets estáticos bajo "/".
 *
 * Si el archivo no existe, el botón "Generar PDF" muestra un error visible.
 * El formulario PDF debe ser de tipo AcroForm (rellenable) con los campos
 * exactos definidos en utils/generarPdf.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { obtener as obtenerCaso } from '../casos/api';
import type { CasoDetalle } from '../casos/types';
import { obtener as obtenerCliente } from '../clientes/api';
import type { Cliente } from '../clientes/types';
import { initUpload, registerDocumento, uploadToStorage } from '../documentos/api';
import { registrarTelegrama } from './api';
import { useGeneradorTelegrama } from './hooks/useGeneradorTelegrama';
import type { ClienteTelegrama, FichaLaboralTelegrama, TipoComunicacion } from './types';
import { generarPdfTelegrama } from './utils/generarPdf';

/**
 * URL del asset del formulario oficial (Vite sirve `frontend/` como raíz).
 * Colocar el archivo en: frontend/telegrama-oficial.pdf
 */
const PDF_URL = '/telegrama-oficial.pdf';

// ── style helpers ───────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: 11,
  color: '#5A6478',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  border: '1.5px solid #E5E2D8',
  borderRadius: 7,
  background: '#FAFAF7',
  padding: '0 12px',
  fontSize: 13,
  color: '#131C2E',
  fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
  outline: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E2D8',
        borderRadius: 12,
        padding: 22,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#1B3A6B',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {num}
        </div>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1B3A6B',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Outer component — carga datos del caso y cliente ─────────────────────────

export default function TelegramaPage() {
  const { casoId: rawId } = useParams<{ casoId: string }>();
  const casoId = Number(rawId);
  const navigate = useNavigate();

  const [caso, setCaso] = useState<CasoDetalle | null>(null);
  const [clienteData, setClienteData] = useState<Cliente | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const casoRes = await obtenerCaso(casoId);
        const clienteRes = await obtenerCliente(casoRes.cliente_id);
        if (!cancelled) {
          setCaso(casoRes);
          setClienteData(clienteRes);
        }
      } catch {
        if (!cancelled) {
          setLoadError('No se pudo cargar el caso. Verificá tu conexión e intentá de nuevo.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [casoId]);

  const pageWrap = (children: React.ReactNode) => (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: '#F2F0EA',
        minHeight: '100vh',
        padding: '32px 32px 48px',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );

  if (loadError) {
    return pageWrap(
      <>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#7B8799',
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            padding: 0,
            marginBottom: 20,
          }}
        >
          ← Volver
        </button>
        <p
          role="alert"
          style={{
            color: '#C9423A',
            fontSize: 14,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {loadError}
        </p>
      </>,
    );
  }

  if (!caso || !clienteData) {
    return pageWrap(
      <p style={{ color: '#7B8799', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
        Cargando caso...
      </p>,
    );
  }

  const fichaMap: FichaLaboralTelegrama = {
    razon_social: caso.ficha?.razon_social ?? null,
    empleador_nombre: caso.ficha?.empleador_nombre ?? null,
    ramo_actividad: caso.ficha?.ramo_actividad ?? null,
    direccion_trabajo: caso.ficha?.direccion_trabajo ?? null,
    direccion_trabajo_cp: caso.ficha?.direccion_trabajo_cp ?? null,
    direccion_trabajo_localidad: caso.ficha?.direccion_trabajo_localidad ?? null,
    direccion_trabajo_provincia: caso.ficha?.direccion_trabajo_provincia ?? null,
  };

  const clienteMap: ClienteTelegrama = {
    nombre: clienteData.nombre,
    dni: clienteData.dni,
    domicilio_real: clienteData.domicilio_real ?? null,
    domicilio_real_cp: clienteData.domicilio_real_cp ?? null,
    domicilio_real_localidad: clienteData.domicilio_real_localidad ?? null,
    domicilio_real_provincia: clienteData.domicilio_real_provincia ?? null,
  };

  return (
    <TelegramaFormLoaded
      casoId={casoId}
      codigoExpediente={caso.codigo_expediente ?? `Caso #${caso.id}`}
      cliente={clienteMap}
      ficha={fichaMap}
    />
  );
}

// ── Inner component — inicializa el hook y renderiza el formulario ────────────

interface TelegramaFormLoadedProps {
  casoId: number;
  codigoExpediente: string;
  cliente: ClienteTelegrama;
  ficha: FichaLaboralTelegrama;
}

const TIPO_LABELS: Record<TipoComunicacion, string> = {
  RENUNCIA: 'Comunicación de renuncia',
  AUSENCIA: 'Comunicación de ausencia',
  OTRO: 'Otro tipo de comunicación',
};

const MAX_CHARS = 500;

function TelegramaFormLoaded({
  casoId,
  codigoExpediente,
  cliente,
  ficha,
}: TelegramaFormLoadedProps) {
  const navigate = useNavigate();
  const hook = useGeneradorTelegrama({ casoId, pdfUrl: PDF_URL, cliente, ficha });

  const [guardando, setGuardando] = useState(false);
  const [guardadoExito, setGuardadoExito] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  /**
   * Guardar como documento:
   *  1. Genera el PDF con los datos actuales del formulario
   *  2. Sube el PDF a R2 via el flujo de documentos (init → PUT → register)
   *  3. Registra el telegrama en el caso (POST /casos/{id}/telegramas)
   */
  const handleGuardar = async () => {
    setGuardando(true);
    setGuardadoExito(false);
    setErrorGuardar(null);
    try {
      // 1. Obtener bytes del PDF template
      const pdfRes = await fetch(PDF_URL);
      if (!pdfRes.ok) {
        throw new Error(
          'No se encontró el formulario oficial del telegrama. ' +
            'Colocar el archivo en frontend/telegrama-oficial.pdf y reiniciar el servidor.',
        );
      }
      const pdfBytes = await pdfRes.arrayBuffer();
      const bytes = await generarPdfTelegrama(pdfBytes, {
        ficha: {
          razon_social: hook.form.razon_social || null,
          empleador_nombre: null,
          ramo_actividad: hook.form.ramo_actividad || null,
          direccion_trabajo: hook.form.direccion_trabajo || null,
          direccion_trabajo_cp: hook.form.direccion_trabajo_cp || null,
          direccion_trabajo_localidad: hook.form.direccion_trabajo_localidad || null,
          direccion_trabajo_provincia: hook.form.direccion_trabajo_provincia || null,
        },
        cliente: {
          nombre: hook.form.nombre_remitente,
          dni: hook.form.dni_remitente,
          domicilio_real: hook.form.domicilio_real || null,
          domicilio_real_cp: hook.form.domicilio_real_cp || null,
          domicilio_real_localidad: hook.form.domicilio_real_localidad || null,
          domicilio_real_provincia: hook.form.domicilio_real_provincia || null,
        },
        cuerpo: hook.form.cuerpo,
        tipo_comunicacion: hook.form.tipo_comunicacion,
      });

      // 2. Subir a R2 como documento del caso
      const nombreArchivo = `telegrama_${hook.form.numero}_${hook.form.nombre_remitente.replace(/\s+/g, '_')}.pdf`;
      const init = await initUpload(casoId, {
        nombre_archivo: nombreArchivo,
        categoria: 'OTRO',
        formato: 'PDF',
      });
      const file = new File([bytes], nombreArchivo, { type: 'application/pdf' });
      await uploadToStorage(init.upload_url, file);
      await registerDocumento(casoId, {
        object_key: init.object_key,
        nombre_archivo: nombreArchivo,
        categoria: 'OTRO',
        formato: 'PDF',
      });

      // 3. Registrar el telegrama en el caso (RN-18 — resultado inicial PENDIENTE)
      await registrarTelegrama(casoId, {
        numero: hook.form.numero,
        tipo_comunicacion: hook.form.tipo_comunicacion,
        cuerpo: hook.form.cuerpo,
        destinatario: hook.form.razon_social,
        domicilio_destino: hook.form.direccion_trabajo,
      });

      setGuardadoExito(true);
    } catch (e) {
      setErrorGuardar(
        e instanceof Error
          ? e.message
          : 'No se pudo guardar el documento. Intentá de nuevo.',
      );
    } finally {
      setGuardando(false);
    }
  };

  const col2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
  const col3: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '120px 1fr 1fr',
    gap: 14,
  };
  const fieldGap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };

  const previewLines = [
    `SR/A:              ${hook.form.razon_social || '—'}`,
    `ACTIVIDAD:         ${hook.form.ramo_actividad || '—'}`,
    `DOMICILIO:         ${hook.form.direccion_trabajo || '—'}, CP ${hook.form.direccion_trabajo_cp || '—'}, ${hook.form.direccion_trabajo_localidad || '—'}, ${hook.form.direccion_trabajo_provincia || '—'}`,
  ];
  const remitLines = [
    `APELLIDO Y NOMBRE: ${hook.form.nombre_remitente || '—'}`,
    `N° DNI:            ${hook.form.dni_remitente || '—'}`,
    `DOMICILIO:         ${hook.form.domicilio_real || '—'}, CP ${hook.form.domicilio_real_cp || '—'}, ${hook.form.domicilio_real_localidad || '—'}, ${hook.form.domicilio_real_provincia || '—'}`,
    `FECHA:             ${fechaHoy}`,
  ];

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: '#F2F0EA',
        minHeight: '100vh',
        padding: '32px 32px 48px',
        boxSizing: 'border-box',
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 20,
          fontSize: 13,
          color: '#7B8799',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <button
          onClick={() => navigate(`/casos/${casoId}/laboral`)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#7B8799',
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Casos
        </button>
        <span style={{ color: '#B0AFA8' }}>/</span>
        <span style={{ color: '#5A6478' }}>{codigoExpediente}</span>
        <span style={{ color: '#B0AFA8' }}>/</span>
        <span style={{ color: '#131C2E', fontWeight: 600 }}>Telegrama</span>
      </div>

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: 26,
            color: '#131C2E',
            margin: 0,
          }}
        >
          Generador de telegrama
        </h1>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#7B8799' }}>
          Ley 23.789
        </span>
      </div>

      {/* Error del hook (generación PDF) */}
      {hook.error && (
        <div
          role="alert"
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#C9423A',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {hook.error}
        </div>
      )}

      {/* Two-column layout */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24, alignItems: 'start' }}
      >
        {/* Left column */}
        <div>
          {/* Card 1 — Configuración */}
          <SectionCard num={1} title="Configuración del telegrama">
            <div style={col2}>
              <Field label="Número de telegrama">
                <select
                  value={hook.form.numero}
                  onChange={(e) =>
                    hook.actualizar('numero', Number(e.target.value) as 1 | 2 | 3)
                  }
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value={1}>Telegrama 1</option>
                  <option value={2}>Telegrama 2</option>
                  <option value={3}>Telegrama 3</option>
                </select>
              </Field>
              <Field label="Tipo de comunicación">
                <select
                  value={hook.form.tipo_comunicacion}
                  onChange={(e) =>
                    hook.actualizar('tipo_comunicacion', e.target.value as TipoComunicacion)
                  }
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {(Object.keys(TIPO_LABELS) as TipoComunicacion[]).map((t) => (
                    <option key={t} value={t}>
                      {TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>

          {/* Card 2 — Destinatario */}
          <SectionCard num={2} title="Destinatario (empleador)">
            <div style={fieldGap}>
              <Field label="Razón social">
                <input
                  style={inputStyle}
                  value={hook.form.razon_social}
                  onChange={(e) => hook.actualizar('razon_social', e.target.value)}
                />
              </Field>
              <Field label="Ramo o actividad">
                <input
                  style={inputStyle}
                  value={hook.form.ramo_actividad}
                  onChange={(e) => hook.actualizar('ramo_actividad', e.target.value)}
                />
              </Field>
              <Field label="Domicilio laboral">
                <input
                  style={inputStyle}
                  value={hook.form.direccion_trabajo}
                  onChange={(e) => hook.actualizar('direccion_trabajo', e.target.value)}
                />
              </Field>
              <div style={col3}>
                <Field label="CP">
                  <input
                    style={inputStyle}
                    value={hook.form.direccion_trabajo_cp}
                    onChange={(e) => hook.actualizar('direccion_trabajo_cp', e.target.value)}
                  />
                </Field>
                <Field label="Localidad">
                  <input
                    style={inputStyle}
                    value={hook.form.direccion_trabajo_localidad}
                    onChange={(e) =>
                      hook.actualizar('direccion_trabajo_localidad', e.target.value)
                    }
                  />
                </Field>
                <Field label="Provincia">
                  <input
                    style={inputStyle}
                    value={hook.form.direccion_trabajo_provincia}
                    onChange={(e) =>
                      hook.actualizar('direccion_trabajo_provincia', e.target.value)
                    }
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Card 3 — Remitente */}
          <SectionCard num={3} title="Remitente (trabajador)">
            <div style={fieldGap}>
              <div style={col2}>
                <Field label="Apellido y nombre">
                  <input
                    style={inputStyle}
                    value={hook.form.nombre_remitente}
                    onChange={(e) => hook.actualizar('nombre_remitente', e.target.value)}
                  />
                </Field>
                <Field label="N° DNI">
                  <input
                    style={inputStyle}
                    value={hook.form.dni_remitente}
                    onChange={(e) => hook.actualizar('dni_remitente', e.target.value)}
                  />
                </Field>
              </div>
              <div style={col2}>
                <Field label="Fecha">
                  <input style={inputStyle} value={fechaHoy} readOnly />
                </Field>
                <Field label="Domicilio real">
                  <input
                    style={inputStyle}
                    value={hook.form.domicilio_real}
                    onChange={(e) => hook.actualizar('domicilio_real', e.target.value)}
                  />
                </Field>
              </div>
              <div style={col3}>
                <Field label="CP">
                  <input
                    style={inputStyle}
                    value={hook.form.domicilio_real_cp}
                    onChange={(e) => hook.actualizar('domicilio_real_cp', e.target.value)}
                  />
                </Field>
                <Field label="Localidad">
                  <input
                    style={inputStyle}
                    value={hook.form.domicilio_real_localidad}
                    onChange={(e) => hook.actualizar('domicilio_real_localidad', e.target.value)}
                  />
                </Field>
                <Field label="Provincia">
                  <input
                    style={inputStyle}
                    value={hook.form.domicilio_real_provincia}
                    onChange={(e) => hook.actualizar('domicilio_real_provincia', e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Card 4 — Texto */}
          <SectionCard num={4} title="Texto del telegrama">
            <textarea
              value={hook.form.cuerpo}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS) {
                  hook.actualizar('cuerpo', e.target.value);
                }
              }}
              placeholder="Ingresá el texto del telegrama..."
              style={{
                width: '100%',
                minHeight: 140,
                border: '1.5px solid #E5E2D8',
                borderRadius: 7,
                background: '#FAFAF7',
                padding: '10px 12px',
                fontSize: 13,
                color: '#131C2E',
                fontFamily: "'Inter', sans-serif",
                boxSizing: 'border-box',
                resize: 'vertical',
                outline: 'none',
                lineHeight: 1.6,
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 6,
              }}
            >
              <span
                style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#7B8799' }}
              >
                El telegrama obrero gratuito tiene límite de 20 palabras por línea según Ley
                23.789.
              </span>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  color:
                    hook.form.cuerpo.length > MAX_CHARS * 0.9 ? '#C9423A' : '#7B8799',
                }}
              >
                {hook.form.cuerpo.length} / {MAX_CHARS} caracteres
              </span>
            </div>

            {/* Advertencia de palabras mínimas */}
            {hook.advertenciaPalabras && (
              <p
                role="status"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  color: '#C9A028',
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                El texto es muy breve — revisá el contenido antes de generar el PDF.
              </p>
            )}

            {/* Feedback guardar */}
            {errorGuardar && (
              <div
                role="alert"
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#C9423A',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {errorGuardar}
              </div>
            )}
            {guardadoExito && (
              <div
                role="status"
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: '#F0FDF4',
                  border: '1px solid #86EFAC',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#166534',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Telegrama guardado como documento del caso.
              </div>
            )}

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={hook.descargar}
                disabled={hook.generando}
                style={{
                  flex: 1,
                  height: 44,
                  background: '#C9A028',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: hook.generando ? 'not-allowed' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  opacity: hook.generando ? 0.7 : 1,
                }}
              >
                {hook.generando ? 'Generando…' : 'Generar PDF'}
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando || guardadoExito}
                style={{
                  flex: 1,
                  height: 44,
                  background: guardadoExito ? '#16A34A' : '#1B3A6B',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: guardando || guardadoExito ? 'not-allowed' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  opacity: guardando ? 0.7 : 1,
                }}
              >
                {guardando
                  ? 'Guardando…'
                  : guardadoExito
                    ? 'Guardado'
                    : 'Guardar como documento'}
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Right column — sticky preview */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E2D8',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E9E6DE' }}>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#131C2E',
                }}
              >
                Previsualización
              </div>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  color: '#7B8799',
                  marginTop: 2,
                }}
              >
                Se actualiza en tiempo real
              </div>
            </div>
            <div style={{ padding: '20px 24px', overflowX: 'auto' }}>
              <pre
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: 11,
                  color: '#131C2E',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}
              >
                {`TELEGRAMA OBRERO GRATUITO — Ley 23.789\n`}
                {`Fecha: ${fechaHoy}\n`}
              </pre>

              {/* Destinatario box */}
              <div style={{ border: '1px solid #131C2E', padding: 10, marginTop: 8 }}>
                <pre
                  style={{
                    fontFamily: "'Courier New', Courier, monospace",
                    fontSize: 11,
                    color: '#131C2E',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                  }}
                >
                  {previewLines.join('\n')}
                </pre>
              </div>

              {/* Remitente box */}
              <div style={{ border: '1px solid #131C2E', padding: 10, marginTop: 8 }}>
                <pre
                  style={{
                    fontFamily: "'Courier New', Courier, monospace",
                    fontSize: 11,
                    color: '#131C2E',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                  }}
                >
                  {remitLines.join('\n')}
                </pre>
              </div>

              {/* Texto box */}
              <div
                style={{
                  border: '1px solid #131C2E',
                  padding: 10,
                  marginTop: 8,
                  minHeight: 60,
                }}
              >
                <pre
                  style={{
                    fontFamily: "'Courier New', Courier, monospace",
                    fontSize: 11,
                    color: hook.form.cuerpo ? '#131C2E' : '#B0AFA8',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                  }}
                >
                  {hook.form.cuerpo || '(texto del telegrama)'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
