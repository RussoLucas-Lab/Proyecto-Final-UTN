import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { IAModal } from '../comunicaciones/IAModal';

const CASO = {
  id: 1,
  expediente: 'EXP-2026-000042',
  cliente: { nombre: 'González Pérez, Carlos', iniciales: 'GP' },
  abogado: 'Dra. Laura Vega',
  etapa_actual: 2, // 0-indexed
};

const ETAPAS_LABORAL = [
  'Toma del cliente',
  'Telegrama 1',
  'Telegrama 2',
  'Telegrama 3',
  'Conciliación',
  'Acuerdo',
  'Juicio Inicial',
  'Prod. pruebas',
  'Vista de causa',
  'Sentencia',
];

const MOCK_DOCUMENTOS = [
  { id: 1, nombre: 'Telegrama_obrero_01.pdf', fecha: '15/03/2026' },
  { id: 2, nombre: 'Contrato_laboral_original.pdf', fecha: '16/03/2026' },
  { id: 3, nombre: 'Recibos_sueldo_2025.pdf', fecha: '18/03/2026' },
];

const MOCK_HISTORIAL = [
  { id: 1, descripcion: 'Avance a Telegrama 2', fecha: '22/06/2026', usuario: 'Dra. Laura Vega', latest: true },
  { id: 2, descripcion: 'Avance a Telegrama 1', fecha: '18/06/2026', usuario: 'Dra. Laura Vega', latest: false },
  { id: 3, descripcion: 'Reunión de admisión con el cliente', fecha: '15/03/2026', usuario: 'Dr. Martín Suárez', latest: false },
  { id: 4, descripcion: 'Documentación inicial recibida', fecha: '15/03/2026', usuario: 'Dra. Laura Vega', latest: false },
  { id: 5, descripcion: 'Cliente registrado en el sistema', fecha: '15/03/2026', usuario: 'Dr. Martín Suárez', latest: false },
];

const MOCK_VENCIMIENTOS = [
  { id: 1, fecha: '30/06/2026', descripcion: 'Plazo para enviar Telegrama 2', upcoming: true },
  { id: 2, fecha: '15/07/2026', descripcion: 'Vencimiento del plazo de conciliación', upcoming: true },
  { id: 3, fecha: '01/09/2026', descripcion: 'Fecha estimada de audiencia', upcoming: false },
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

export default function CasoLaboralPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showIAModal, setShowIAModal] = useState(false);
  const [showConfirmRetroceder, setShowConfirmRetroceder] = useState(false);

  const etapaActualLabel = ETAPAS_LABORAL[CASO.etapa_actual] ?? '—';

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
          {CASO.expediente}
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
            {CASO.cliente.iniciales}
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
              {CASO.cliente.nombre}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#7B8799' }}>
                {CASO.expediente}
              </span>
              <span style={{ color: '#C5CDD8', fontSize: 12 }}>·</span>
              <Badge bg="#E8EDF8" color="#1B3A6B">
                Laboral
              </Badge>
              <Badge bg="#E8EDF8" color="#1B3A6B">
                {etapaActualLabel}
              </Badge>
              <span style={{ fontSize: 13, color: '#5A6478' }}>
                👤 {CASO.abogado}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowConfirmRetroceder(true)}
            style={{
              background: '#FEE4E2',
              color: '#C9423A',
              border: '1px solid #F5C2C0',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Retroceder etapa
          </button>
          <button
            style={{
              background: '#1B3A6B',
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
            Avanzar etapa →
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E2D8',
          borderRadius: 12,
          padding: '18px 22px',
          marginTop: 20,
          overflowX: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            minWidth: 'max-content',
          }}
        >
          {ETAPAS_LABORAL.map((etapa, idx) => {
            const isDone = idx < CASO.etapa_actual;
            const isActive = idx === CASO.etapa_actual;
            const isPending = idx > CASO.etapa_actual;
            const isLast = idx === ETAPAS_LABORAL.length - 1;

            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start' }}>
                {/* Step */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      ...(isDone
                        ? {
                            background: '#1B3A6B',
                            color: '#FFFFFF',
                          }
                        : isActive
                        ? {
                            background: '#1B3A6B',
                            color: '#FFFFFF',
                            border: '3px solid #C9A028',
                            boxSizing: 'border-box',
                          }
                        : {
                            background: 'transparent',
                            color: '#9BA8B8',
                            border: '1.5px solid #D0CCC4',
                          }),
                    }}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: isDone || isActive ? 600 : 400,
                      color: isDone || isActive ? '#1B3A6B' : '#9BA8B8',
                      textAlign: 'center',
                      maxWidth: 72,
                      lineHeight: 1.3,
                    }}
                  >
                    {etapa}
                  </span>
                </div>

                {/* Connector */}
                {!isLast && (
                  <div
                    style={{
                      width: 40,
                      height: 2,
                      background: isDone ? '#1B3A6B' : '#E5E2D8',
                      marginTop: 13,
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

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
          onClick={() => navigate('/telegrama/1')}
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              {[
                { label: 'Área', value: <Badge bg="#E8EDF8" color="#1B3A6B">Laboral</Badge> },
                { label: 'Expediente', value: <span style={{ fontFamily: 'monospace', fontSize: 13 }}>EXP-2026-000042</span> },
                { label: 'Inicio', value: '15/03/2026' },
                { label: 'Últ. movimiento', value: '22/06/2026' },
                { label: 'Abogado', value: CASO.abogado },
                {
                  label: 'Etapa actual',
                  value: <Badge bg="#E8EDF8" color="#1B3A6B">{etapaActualLabel}</Badge>,
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
          </CardSection>

          {/* Documentos */}
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
            {/* Drag & drop zone */}
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
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                style={{ color: '#9BA8B8', margin: '0 auto 8px' }}
              >
                <path
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  stroke="#9BA8B8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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

            {/* File list */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {MOCK_DOCUMENTOS.map((doc, i) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom:
                      i < MOCK_DOCUMENTOS.length - 1 ? '1px solid #F2F0EA' : 'none',
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
                      letterSpacing: '0.3px',
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
                      flexShrink: 0,
                    }}
                    title="Descargar"
                  >
                    ⬇
                  </button>
                </div>
              ))}
            </div>
          </CardSection>

          {/* Historial */}
          <CardSection title="Historial">
            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div
                style={{
                  position: 'absolute',
                  left: 7,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  background: '#E9E6DE',
                  borderRadius: 2,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {MOCK_HISTORIAL.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'flex-start',
                      position: 'relative',
                    }}
                  >
                    {/* Dot */}
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        flexShrink: 0,
                        marginTop: 2,
                        zIndex: 1,
                        ...(event.latest
                          ? { background: '#1B3A6B' }
                          : {
                              background: '#FFFFFF',
                              border: '2px solid #D0CCC4',
                            }),
                      }}
                    />
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#131C2E',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {event.descripcion}
                      </p>
                      <p
                        style={{
                          margin: '3px 0 0',
                          fontSize: 12,
                          color: '#7B8799',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {event.fecha} · {event.usuario}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardSection>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Vencimientos */}
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
              Vencimientos del caso
            </p>
            <div>
              {MOCK_VENCIMIENTOS.map((v, i) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom:
                      i < MOCK_VENCIMIENTOS.length - 1 ? '1px solid #F2F0EA' : 'none',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      borderRadius: 2,
                      flexShrink: 0,
                      alignSelf: 'stretch',
                      background: v.upcoming ? '#C9A028' : '#D0CCC4',
                      minHeight: 36,
                    }}
                  />
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#131C2E',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {v.fecha}
                    </p>
                    <p
                      style={{
                        margin: '3px 0 0',
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#5A6478',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {v.descripcion}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
              Contacto
            </p>
            <p
              style={{
                margin: '0 0 4px',
                fontSize: 14,
                fontWeight: 600,
                color: '#131C2E',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {CASO.cliente.nombre}
            </p>
            <p style={{ margin: '0 0 2px', fontSize: 13, color: '#5A6478', fontFamily: 'Inter, sans-serif' }}>
              +54 9 261 555-1234
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#9BA8B8', fontFamily: 'Inter, sans-serif' }}>
              cgonzalez@email.com
            </p>
            <button
              style={{
                width: '100%',
                height: 40,
                marginTop: 12,
                background: '#25D366',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M11.956 0C5.375 0 .015 5.36.015 11.94c0 2.102.546 4.07 1.499 5.786L.015 24l6.418-1.682a11.94 11.94 0 005.523 1.364h.005c6.581 0 11.94-5.36 11.94-11.94S18.537 0 11.956 0zm0 21.818a9.877 9.877 0 01-5.036-1.375l-.361-.214-3.74.98.998-3.648-.235-.374a9.842 9.842 0 01-1.507-5.273c0-5.445 4.432-9.878 9.878-9.878 5.446 0 9.878 4.433 9.878 9.878 0 5.446-4.432 9.904-9.875 9.904z" />
              </svg>
              Enviar WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* IAModal */}
      {showIAModal && <IAModal onClose={() => setShowIAModal(false)} />}

      {/* Confirm retroceder modal */}
      {showConfirmRetroceder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 420,
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 32,
              boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#FEE4E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="#C9423A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 600,
                fontSize: 20,
                color: '#131C2E',
                margin: '0 0 10px',
              }}
            >
              ¿Retroceder etapa?
            </h3>
            <p
              style={{
                fontSize: 14,
                color: '#5A6478',
                margin: '0 0 24px',
                fontFamily: 'Inter, sans-serif',
                lineHeight: 1.6,
              }}
            >
              Esta acción retrocederá el caso a la etapa anterior. ¿Estás seguro?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setShowConfirmRetroceder(false)}
                style={{
                  background: '#F2F0EA',
                  color: '#5A6478',
                  border: '1px solid #D8D4CA',
                  borderRadius: 8,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowConfirmRetroceder(false)}
                style={{
                  background: '#C9423A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Sí, retroceder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
