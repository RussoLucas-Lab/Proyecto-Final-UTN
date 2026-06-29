import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { IAModal } from '../comunicaciones/IAModal';
import { HistorialTimeline } from './components/HistorialTimeline';
import { RetrocederModal } from './components/RetrocederModal';
import { StepperEtapas } from './components/StepperEtapas';
import { StepperVisualART } from './components/StepperVisualART';
import { useCaso } from './hooks/useCaso';
import { useEtapasArea } from './hooks/useEtapasArea';

const MOCK_DOCUMENTOS = [
  { id: 1, nombre: 'Denuncia_ART_inicial.pdf', fecha: '20/06/2026' },
  { id: 2, nombre: 'Historia_clinica_accidente.pdf', fecha: '10/06/2026' },
];

const TIPO_RECLAMO_LABEL: Record<string, string> = {
  ACCIDENTE: 'Accidente laboral',
  ENFERMEDAD: 'Enfermedad profesional',
};

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        background: bg, color, borderRadius: 4, padding: '2px 7px',
        fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
      }}
    >
      {children}
    </span>
  );
}

function normalizarTelefonoWA(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('54')) {
    const rest = d.slice(2);
    if (rest.startsWith('9')) {
      // ok
    } else if (rest.startsWith('0')) {
      d = '549' + rest.slice(1);
    } else {
      d = '549' + rest;
    }
  } else if (d.startsWith('0')) {
    d = '549' + d.slice(1);
  } else {
    d = '549' + d;
  }
  if (d.length > 13) {
    const m = d.match(/^(549\d{2,4}?)15(\d{6,8})$/);
    if (m) d = m[1] + m[2];
  }
  if (d.length < 11 || d.length > 14) return null;
  return d;
}

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function CasoARTPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const casoId = id ? parseInt(id, 10) : undefined;

  useAuth();

  const { caso, historial, isLoading, error, avanzar, retroceder } = useCaso(casoId);
  const { etapas } = useEtapasArea('ART');

  const [showIAModal, setShowIAModal] = useState(false);
  const [showRetrocederModal, setShowRetrocederModal] = useState(false);

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9BA8B8', fontSize: 14 }}>
        Cargando caso…
      </div>
    );
  }

  if (error || !caso) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#991B1B', fontSize: 14 }}>
        {error ?? 'Caso no encontrado'}
      </div>
    );
  }

  const ultimoAvanceAEtapaActual = [...historial]
    .reverse()
    .find((h) => h.etapa_nueva_id === caso.etapa_actual_id && h.evento === 'avance');
  const etapaAnterior =
    ultimoAvanceAEtapaActual?.etapa_anterior_id != null
      ? {
          id: ultimoAvanceAEtapaActual.etapa_anterior_id,
          nombre: ultimoAvanceAEtapaActual.etapa_anterior_nombre ?? `Etapa ${ultimoAvanceAEtapaActual.etapa_anterior_id}`,
        }
      : null;

  return (
    <div
      style={{
        fontFamily: 'Inter, sans-serif',
        color: '#131C2E',
        padding: '28px 32px',
        background: '#F2F0EA',
        minHeight: '100vh',
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <button
          onClick={() => navigate('/casos')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#8B95A5', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Casos
        </button>
        <span style={{ color: '#D0CCC4' }}>/</span>
        <span style={{ fontSize: 13, color: '#131C2E', fontWeight: 500 }}>
          {caso.codigo_expediente ?? `CASO-${caso.id}`} · {caso.cliente_nombre}
        </span>
      </div>

      {/* Header card con stepper visual integrado */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E2D8',
          borderRadius: 12,
          padding: '22px 26px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            style={{
              width: 46, height: 46, borderRadius: 10, background: '#E3F5F5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#0B7285', flexShrink: 0,
            }}
          >
            {(caso.cliente_nombre ?? `C${caso.cliente_id}`).slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700, fontSize: 22, color: '#131C2E',
                margin: '0 0 6px', lineHeight: 1.1,
              }}
            >
              {caso.cliente_nombre ?? `Cliente #${caso.cliente_id}`}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7B8799', background: '#F2F0EA', padding: '2px 8px', borderRadius: 4 }}>
                {caso.codigo_expediente ?? '—'}
              </span>
              <Badge bg="#E3F5F5" color="#0B7285">ART</Badge>
              {caso.tipo_reclamo && (
                <Badge bg="#FEF3E2" color="#B45309">
                  {TIPO_RECLAMO_LABEL[caso.tipo_reclamo] ?? caso.tipo_reclamo}
                </Badge>
              )}
              {caso.etapa_actual && (
                <Badge bg="#E3F5F5" color="#0B7285">{caso.etapa_actual.nombre}</Badge>
              )}
              <span style={{ fontSize: 12, color: '#8B95A5' }}>
                Abogado #{caso.abogado_responsable_id}
              </span>
            </div>
          </div>
        </div>

        {/* Stepper visual bifurcado ART — data-driven (ADR-0008) */}
        {caso.etapa_actual && etapas.length > 0 && (
          <StepperVisualART
            etapas={etapas}
            etapaActualId={caso.etapa_actual_id}
            tipoReclamo={caso.tipo_reclamo ?? null}
          />
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => setShowIAModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#C9A028', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Generar actualización
        </button>
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Datos del caso */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E2D8', padding: 22 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 16px' }}>
              Datos del caso
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Expediente', value: <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{caso.codigo_expediente ?? '—'}</span> },
                { label: 'Tipo de reclamo', value: caso.tipo_reclamo ? TIPO_RECLAMO_LABEL[caso.tipo_reclamo] : '—' },
                { label: 'Inicio', value: formatFecha(caso.fecha_inicio) },
                { label: 'Alta', value: formatFecha(caso.creado_en) },
                { label: 'Abogado', value: `#${caso.abogado_responsable_id}` },
                {
                  label: 'Etapa actual',
                  value: caso.etapa_actual ? (
                    <Badge bg="#E3F5F5" color="#0B7285">{caso.etapa_actual.nombre}</Badge>
                  ) : '—',
                },
              ].map((item, i) => (
                <div key={i}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    {item.label}
                  </p>
                  <div style={{ fontSize: 13, color: '#131C2E', fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
            {caso.observaciones && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F2F0EA' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Observaciones
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#5A6478', lineHeight: 1.6 }}>
                  {caso.observaciones}
                </p>
              </div>
            )}
          </div>

          {/* Documentos */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E2D8', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: '.5px', margin: 0 }}>
                Documentos
              </h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1B3A6B', color: '#fff', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Subir archivo
                <input type="file" style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ border: '2px dashed #D8D4CA', borderRadius: 10, padding: 20, textAlign: 'center', background: '#FAFAF7', marginBottom: 14 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C0BAB0" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div style={{ fontSize: 13, color: '#8B95A5' }}>Arrastre archivos aquí o use el botón de subir</div>
              <div style={{ fontSize: 11, color: '#B0A89C', marginTop: 4 }}>PDF, DOC, JPG — Solo el abogado puede subir documentos</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MOCK_DOCUMENTOS.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#F7F6F1', borderRadius: 8, border: '1px solid #E9E6DE' }}>
                  <div style={{ width: 32, height: 32, background: '#FEE4E2', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#C9423A' }}>PDF</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#131C2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.nombre}</div>
                    <div style={{ fontSize: 11, color: '#8B95A5', marginTop: 1 }}>Subido el {doc.fecha}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historial */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E2D8', padding: 22 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 18px' }}>
              Historial del caso
            </h3>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <HistorialTimeline historial={historial} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Panel control de etapa */}
          {caso.etapa_actual && (
            <StepperEtapas
              etapaActual={caso.etapa_actual}
              transicionesValidas={caso.transiciones_validas}
              onAvanzar={avanzar}
              onRetroceder={etapaAnterior ? () => setShowRetrocederModal(true) : undefined}
              area="ART"
            />
          )}

          {/* Contacto rápido */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E2D8', padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 14px' }}>
              Contacto rápido
            </h3>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#131C2E', marginBottom: 2 }}>
              {caso.cliente_nombre ?? `Cliente #${caso.cliente_id}`}
            </div>
            {(() => {
              const telRaw = caso.cliente_telefono ?? null;
              const waNum = telRaw ? normalizarTelefonoWA(telRaw) : null;
              const waUrl = waNum ? `https://wa.me/${waNum}` : null;
              return (
                <a
                  href={waUrl ?? undefined}
                  target={waUrl ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={!waUrl ? (e) => e.preventDefault() : undefined}
                  title={!telRaw ? 'Sin celular registrado' : !waUrl ? 'Número inválido' : 'Abrir WhatsApp'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: waUrl ? '#25D366' : '#C5CDD8', color: '#FFFFFF',
                    borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none', cursor: waUrl ? 'pointer' : 'not-allowed',
                    opacity: waUrl ? 1 : 0.6, userSelect: 'none',
                    marginTop: 14, width: '100%', boxSizing: 'border-box',
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Abrir en WhatsApp
                </a>
              );
            })()}
          </div>
        </div>
      </div>

      {showIAModal && <IAModal onClose={() => setShowIAModal(false)} />}

      {showRetrocederModal && caso.etapa_actual && etapaAnterior && (
        <RetrocederModal
          etapaActualNombre={caso.etapa_actual.nombre}
          etapaDestinoId={etapaAnterior.id}
          etapaDestinoNombre={etapaAnterior.nombre}
          onConfirmar={async (etapaDestinoId) => {
            await retroceder(etapaDestinoId, true);
            setShowRetrocederModal(false);
          }}
          onCancelar={() => setShowRetrocederModal(false)}
        />
      )}
    </div>
  );
}
