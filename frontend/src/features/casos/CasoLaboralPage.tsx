/**
 * Pantalla de detalle del caso LABORAL.
 *
 * Usa useCaso(id) — datos cargados desde la API, nunca hardcodeados.
 * El stepper es data-driven (ADR-0008): etapas y transiciones vienen del backend.
 * El historial usa HistorialTimeline (inmutable, RN-06).
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { IAModal } from '../comunicaciones/IAModal';
import { useTelegramas } from '../telegramas/hooks/useTelegramas';
import type { ResultadoTelegrama } from '../telegramas/types';
import { HistorialTimeline } from './components/HistorialTimeline';
import { RetrocederModal } from './components/RetrocederModal';
import { StepperEtapas } from './components/StepperEtapas';
import { useCaso } from './hooks/useCaso';

function parseTelegramaNumero(nombre: string | undefined): 1 | 2 | 3 | null {
  if (!nombre) return null;
  const m = nombre.match(/telegrama\s+(\d)/i);
  const n = m ? parseInt(m[1]) : null;
  return n === 1 || n === 2 || n === 3 ? n : null;
}

const MOCK_DOCUMENTOS = [
  { id: 1, nombre: 'Telegrama_obrero_01.pdf', fecha: '15/03/2026' },
  { id: 2, nombre: 'Contrato_laboral_original.pdf', fecha: '16/03/2026' },
  { id: 3, nombre: 'Recibos_sueldo_2025.pdf', fecha: '18/03/2026' },
];

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 4,
        padding: '2px 7px',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {children}
    </span>
  );
}

function CardSection({
  title,
  children,
  style,
  action,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E2D8',
        borderRadius: 12,
        padding: 22,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#131C2E',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function normalizarTelefonoWA(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (!d) return null;

  if (d.startsWith('54')) {
    const rest = d.slice(2);
    if (rest.startsWith('9')) {
      // already 549... — keep as is
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

  // Remove '15' mobile prefix if present after area code: 549{area}15{number}
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
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function CasoLaboralPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const casoId = id ? parseInt(id, 10) : undefined;

  useAuth(); // mantener sesión activa

  const { caso, historial, isLoading, error, avanzar, retroceder } = useCaso(casoId);
  const { telegramas, setResultado } = useTelegramas(casoId);

  const telegramaNumero = parseTelegramaNumero(caso?.etapa_actual?.nombre);
  const telegramaActual = telegramaNumero ? telegramas.find((t) => t.numero === telegramaNumero) ?? null : null;
  const resultadoActual = telegramaActual?.resultado ?? null;
  const hayTelegramaPendiente =
    telegramaNumero !== null && (!resultadoActual || resultadoActual === 'PENDIENTE');

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

  // Etapa natural anterior: buscamos el último "avance" que nos trajo a la etapa actual.
  // Usar la última entrada del historial es incorrecto si el movimiento más reciente fue
  // un retroceso (e.g. T3→T2): en ese caso el anterior natural sigue siendo T1, no T3.
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
      <button
        onClick={() => navigate('/casos')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#5A6478',
          fontSize: 13,
          fontWeight: 500,
          padding: 0,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ← Casos /{' '}
        <span style={{ color: '#131C2E', fontFamily: 'monospace', fontWeight: 600 }}>
          {caso.codigo_expediente ?? `CASO-${caso.id}`}
        </span>
      </button>

      {/* Case header card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E2D8',
          borderRadius: 12,
          padding: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: '#E8EDF8',
              color: '#1B3A6B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {(caso.cliente_nombre ?? `C${caso.cliente_id}`).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: 22,
                color: '#131C2E',
                margin: '0 0 4px',
              }}
            >
              {caso.cliente_nombre ?? `Cliente #${caso.cliente_id}`}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#7B8799' }}>
                {caso.codigo_expediente ?? '—'}
              </span>
              <span style={{ color: '#C5CDD8', fontSize: 12 }}>·</span>
              <Badge bg="#E8EDF8" color="#1B3A6B">
                Laboral
              </Badge>
              {caso.etapa_actual && (
                <Badge bg="#E8EDF8" color="#1B3A6B">
                  {caso.etapa_actual.nombre}
                </Badge>
              )}
              <span style={{ fontSize: 13, color: '#5A6478' }}>
                Abogado #{caso.abogado_responsable_id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper — data-driven, ADR-0008 */}
      {caso.etapa_actual && (
        <div style={{ marginTop: 20 }}>
          <StepperEtapas
            etapaActual={caso.etapa_actual}
            transicionesValidas={caso.transiciones_validas}
            onAvanzar={avanzar}
            onRetroceder={etapaAnterior ? () => setShowRetrocederModal(true) : undefined}
            area="LABORAL"
            avanzarBloqueado={hayTelegramaPendiente}
            resultadoTelegrama={telegramaNumero !== null ? resultadoActual : undefined}
            onSetResultadoTelegrama={
              telegramaNumero !== null
                ? (r: ResultadoTelegrama) => setResultado(telegramaNumero, r)
                : undefined
            }
          />
        </div>
      )}

      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          onClick={() => setShowIAModal(true)}
          style={{
            background: '#C9A028',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Generar actualización
        </button>
        <button
          onClick={() => navigate(`/telegrama/${caso.id}`)}
          style={{
            background: '#FFFFFF',
            color: '#1B3A6B',
            border: '1.5px solid #1B3A6B',
            borderRadius: 8,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Generar telegrama
        </button>
      </div>

      {/* Content grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 20,
          marginTop: 16,
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Datos del caso */}
          <CardSection title="Datos del caso">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Área', value: <Badge bg="#E8EDF8" color="#1B3A6B">Laboral</Badge> },
                {
                  label: 'Expediente',
                  value: (
                    <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {caso.codigo_expediente ?? '—'}
                    </span>
                  ),
                },
                { label: 'Inicio', value: formatFecha(caso.fecha_inicio) },
                { label: 'Alta', value: formatFecha(caso.creado_en) },
                { label: 'Abogado responsable', value: `#${caso.abogado_responsable_id}` },
                {
                  label: 'Etapa actual',
                  value: caso.etapa_actual ? (
                    <Badge bg="#E8EDF8" color="#1B3A6B">
                      {caso.etapa_actual.nombre}
                    </Badge>
                  ) : (
                    '—'
                  ),
                },
              ].map((item, i) => (
                <div key={i}>
                  <p
                    style={{
                      margin: '0 0 4px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#7B8799',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    {item.label}
                  </p>
                  <div style={{ fontSize: 13, color: '#131C2E', fontWeight: 500 }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {caso.observaciones && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #F2F0EA' }}>
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#7B8799',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}
                >
                  Observaciones
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#5A6478', lineHeight: 1.5 }}>
                  {caso.observaciones}
                </p>
              </div>
            )}
          </CardSection>

          {/* Documentos (placeholder — RF-13 fuera de scope de esta tarea) */}
          <CardSection
            title="Documentos"
            action={
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1B3A6B',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                + Subir documento
              </button>
            }
          >
            <div
              style={{
                border: '2px dashed #D8D4CA',
                borderRadius: 8,
                background: '#FAFAF7',
                padding: 28,
                textAlign: 'center',
                marginBottom: 16,
                cursor: 'pointer',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#5A6478',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Arrastrá archivos aquí
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9BA8B8', fontFamily: 'Inter, sans-serif' }}>
                o hacé clic para seleccionar
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {MOCK_DOCUMENTOS.map((doc, i) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: i < MOCK_DOCUMENTOS.length - 1 ? '1px solid #F2F0EA' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: '#FEE4E2',
                      color: '#C9423A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 800,
                      flexShrink: 0,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    PDF
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#131C2E',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.nombre}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9BA8B8' }}>
                      Subido el {doc.fecha}
                    </p>
                  </div>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#7B8799',
                      padding: 4,
                    }}
                    title="Descargar"
                  >
                    ⬇
                  </button>
                </div>
              ))}
            </div>
          </CardSection>

          {/* Historial — data-driven, inmutable (RN-06) */}
          <CardSection title="Historial">
            <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              <HistorialTimeline historial={historial} />
            </div>
          </CardSection>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Ficha laboral */}
          {caso.ficha && (
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E2D8',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <p
                style={{
                  margin: '0 0 14px',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#131C2E',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Ficha laboral
              </p>
              {[
                { label: 'Empleador', value: caso.ficha.empleador_nombre },
                { label: 'Ramo', value: caso.ficha.ramo_actividad },
                { label: 'Jornada', value: caso.ficha.jornada },
                { label: 'Remuneración', value: caso.ficha.remuneracion ? `$${caso.ficha.remuneracion}` : null },
              ]
                .filter((f) => f.value)
                .map((f, i) => (
                  <div
                    key={i}
                    style={{
                      borderBottom: '1px solid #F2F0EA',
                      padding: '8px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#7B8799',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        fontWeight: 600,
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {f.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
                      {f.value}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Contacto rápido */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E2D8',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <p
              style={{
                margin: '0 0 14px',
                fontSize: 15,
                fontWeight: 700,
                color: '#131C2E',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Contacto Rápido
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
              {caso.cliente_nombre ?? `Cliente #${caso.cliente_id}`}
            </p>
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
                  title={
                    !telRaw
                      ? 'El cliente no tiene celular registrado'
                      : !waUrl
                      ? 'El número registrado no es válido para WhatsApp'
                      : 'Abrir chat de WhatsApp'
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: waUrl ? '#25D366' : '#C5CDD8',
                    color: '#FFFFFF',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    textDecoration: 'none',
                    cursor: waUrl ? 'pointer' : 'not-allowed',
                    opacity: waUrl ? 1 : 0.6,
                    userSelect: 'none',
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Chatear por WhatsApp
                </a>
              );
            })()}
          </div>
        </div>
      </div>

      {/* IAModal */}
      {showIAModal && <IAModal onClose={() => setShowIAModal(false)} />}

      {/* RetrocederModal */}
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
