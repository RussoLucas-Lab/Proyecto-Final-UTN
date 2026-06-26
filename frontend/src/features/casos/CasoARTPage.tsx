/**
 * Pantalla de detalle del caso ART.
 *
 * Usa useCaso(id) — datos cargados desde la API, nunca hardcodeados.
 * El stepper es data-driven (ADR-0008): etapas y transiciones vienen del backend.
 * El historial usa HistorialTimeline (inmutable, RN-06).
 * No incluye botón de telegrama (ley 23.789 aplica solo a Laboral).
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { IAModal } from '../comunicaciones/IAModal';
import { HistorialTimeline } from './components/HistorialTimeline';
import { RetrocederModal } from './components/RetrocederModal';
import { StepperEtapas } from './components/StepperEtapas';
import { useCaso } from './hooks/useCaso';
import type { Etapa } from './types';

const MOCK_DOCUMENTOS = [
  { id: 1, nombre: 'Denuncia_ART_inicial.pdf', fecha: '20/06/2026' },
  { id: 2, nombre: 'Historia_clinica_accidente.pdf', fecha: '10/06/2026' },
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

const TIPO_RECLAMO_LABEL: Record<string, string> = {
  ACCIDENTE: 'Accidente',
  ENFERMEDAD: 'Enfermedad profesional',
};

export default function CasoARTPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const casoId = id ? parseInt(id, 10) : undefined;

  useAuth(); // mantener sesión activa

  const { caso, historial, isLoading, error, avanzar, retroceder } = useCaso(casoId);

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

  // Etapas anteriores disponibles para retroceder
  const etapasParaRetroceder: Etapa[] = historial
    .filter((h) => h.etapa_anterior_id !== null && h.etapa_nueva_id !== caso.etapa_actual_id)
    .reduce<Etapa[]>((acc, h) => {
      const etapaId = h.etapa_anterior_id;
      if (etapaId && !acc.some((e) => e.id === etapaId)) {
        acc.push({
          id: etapaId,
          nombre: `Etapa ${etapaId}`,
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
              background: '#E3F5F5',
              color: '#0B7285',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            C{caso.cliente_id}
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
              Cliente #{caso.cliente_id}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#7B8799' }}>
                {caso.codigo_expediente ?? '—'}
              </span>
              <span style={{ color: '#C5CDD8', fontSize: 12 }}>·</span>
              <Badge bg="#E3F5F5" color="#0B7285">
                ART
              </Badge>
              {caso.tipo_reclamo && (
                <Badge bg="#E3F5F5" color="#0B7285">
                  {TIPO_RECLAMO_LABEL[caso.tipo_reclamo] ?? caso.tipo_reclamo}
                </Badge>
              )}
              {caso.etapa_actual && (
                <Badge bg="#E3F5F5" color="#0B7285">
                  {caso.etapa_actual.nombre}
                </Badge>
              )}
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
            area="ART"
          />
        </div>
      )}

      {/* Action buttons row — ART no tiene telegrama */}
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
                { label: 'Área', value: <Badge bg="#E3F5F5" color="#0B7285">ART</Badge> },
                {
                  label: 'Expediente',
                  value: (
                    <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {caso.codigo_expediente ?? '—'}
                    </span>
                  ),
                },
                { label: 'Tipo de reclamo', value: caso.tipo_reclamo ? TIPO_RECLAMO_LABEL[caso.tipo_reclamo] : '—' },
                { label: 'Inicio', value: formatFecha(caso.fecha_inicio) },
                { label: 'Alta', value: formatFecha(caso.creado_en) },
                { label: 'Abogado responsable', value: `#${caso.abogado_responsable_id}` },
                {
                  label: 'Etapa actual',
                  value: caso.etapa_actual ? (
                    <Badge bg="#E3F5F5" color="#0B7285">
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

          {/* Documentos (placeholder) */}
          <CardSection
            title="Documentos"
            action={
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#0B7285',
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
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#5A6478', fontFamily: 'Inter, sans-serif' }}>
                Arrastrá archivos aquí
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9BA8B8', fontFamily: 'Inter, sans-serif' }}>
                o hacé clic para seleccionar
              </p>
            </div>
            <div>
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
                      width: 32, height: 32, borderRadius: 6, background: '#FEE4E2', color: '#C9423A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, flexShrink: 0, fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    PDF
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#131C2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.nombre}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9BA8B8' }}>Subido el {doc.fecha}</p>
                  </div>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7B8799', padding: 4 }} title="Descargar">⬇</button>
                </div>
              ))}
            </div>
          </CardSection>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Historial — data-driven, inmutable (RN-06) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E2D8',
              borderRadius: 12,
              padding: 22,
            }}
          >
            <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
              Historial
            </p>
            <HistorialTimeline historial={historial} />
          </div>

          {/* Contacto rápido (placeholder) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E2D8',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <p style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
              Contacto
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
              Cliente #{caso.cliente_id}
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
