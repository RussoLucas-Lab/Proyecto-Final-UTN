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
import type { Etapa } from './types';

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

  // Etapas a las que se puede retroceder: todas las etapas anteriores en el historial
  // que sean distintas a la actual y del mismo área (el backend valida esto).
  // Usamos los ids únicos del historial para construir la lista de opciones.
  const etapasParaRetroceder: Etapa[] = historial
    .filter((h) => h.etapa_anterior_id !== null && h.etapa_nueva_id !== caso.etapa_actual_id)
    .reduce<Etapa[]>((acc, h) => {
      // Solo etapas referenciadas como destino de algún evento que ya fue visitado
      const etapa = h.etapa_anterior_id;
      if (etapa && !acc.some((e) => e.id === etapa)) {
        // Construir un Etapa mínimo a partir del historial
        // (el nombre se muestra como "Etapa {id}" si no tenemos detalle completo)
        acc.push({
          id: etapa,
          nombre: `Etapa ${etapa}`,
          area: caso.area,
          fase: caso.etapa_actual?.fase ?? 'EXTRAJUDICIAL',
          orden: 0,
          es_terminal: false,
        });
      }
      return acc;
    }, []);

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
            onRetroceder={() => setShowRetrocederModal(true)}
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
            <HistorialTimeline historial={historial} />
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

          {/* Contacto rápido (placeholder) */}
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
              Contacto
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
              {caso.cliente_nombre ?? `Cliente #${caso.cliente_id}`}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#9BA8B8', fontFamily: 'Inter, sans-serif' }}>
              Ver datos en sección Clientes
            </p>
          </div>
        </div>
      </div>

      {/* IAModal */}
      {showIAModal && <IAModal onClose={() => setShowIAModal(false)} />}

      {/* RetrocederModal */}
      {showRetrocederModal && caso.etapa_actual && (
        <RetrocederModal
          etapaActual={caso.etapa_actual}
          etapasDisponibles={etapasParaRetroceder}
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
