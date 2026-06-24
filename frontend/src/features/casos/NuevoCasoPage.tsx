import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Area } from '../../shared/types';

const ABOGADOS = [
  { id: 1, label: 'Dr. Martín Suárez (Socio)' },
  { id: 2, label: 'Dra. Laura Vega (Laboral)' },
  { id: 3, label: 'Dr. Pablo Rossi (ART)' },
];

const MOCK_CLIENT = {
  nombre: 'González Pérez, Carlos',
  dni: '28.456.123',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 14px',
        fontSize: 11,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        color: '#7B8799',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
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
      {children}
    </div>
  );
}

export default function NuevoCasoPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(false);
  const [area, setArea] = useState<Area | null>(null);
  const [abogadoId, setAbogadoId] = useState<number>(1);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setSearchQuery(v);
    setShowResult(v.trim().length > 0);
  }

  const abogadoLabel = ABOGADOS.find((a) => a.id === abogadoId)?.label ?? '—';
  const canCreate = clienteSeleccionado && area !== null;

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
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ← Casos / <span style={{ color: '#131C2E', fontWeight: 600 }}>Nuevo caso</span>
      </button>

      {/* Two-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 20,
          marginTop: 24,
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card A: Búsqueda de cliente */}
          <Card>
            <SectionLabel>1. Cliente</SectionLabel>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9BA8B8',
                  pointerEvents: 'none',
                  fontSize: 15,
                }}
              >
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Buscar por nombre o DNI..."
                style={{
                  width: '100%',
                  height: 40,
                  border: '1.5px solid #E5E2D8',
                  borderRadius: 8,
                  background: '#FAFAF7',
                  paddingLeft: 36,
                  paddingRight: 12,
                  fontSize: 13,
                  color: '#131C2E',
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {showResult && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    background: '#F7F6F1',
                    border: clienteSeleccionado ? '1.5px solid #1B3A6B' : '1px solid #E5E2D8',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => setClienteSeleccionado((prev) => !prev)}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#131C2E',
                      }}
                    >
                      {MOCK_CLIENT.nombre}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7B8799' }}>
                      DNI: {MOCK_CLIENT.dni}
                    </p>
                  </div>
                  {clienteSeleccionado && (
                    <span
                      style={{
                        background: '#E6F4EE',
                        color: '#1A7A4A',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      ✓ Seleccionado
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Card B: Área y tipo */}
          <Card>
            <SectionLabel>2. Área del caso</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Laboral */}
              <div
                onClick={() => setArea('LABORAL')}
                style={{
                  border: area === 'LABORAL' ? '2px solid #1B3A6B' : '1.5px solid #E5E2D8',
                  background: area === 'LABORAL' ? '#EEF2FA' : '#F7F6F1',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>⚖️</span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: area === 'LABORAL' ? '#1B3A6B' : '#131C2E',
                    }}
                  >
                    Laboral
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#7B8799' }}>Derecho del trabajo</p>
              </div>

              {/* ART */}
              <div
                onClick={() => setArea('ART')}
                style={{
                  border: area === 'ART' ? '2px solid #0B7285' : '1.5px solid #E5E2D8',
                  background: area === 'ART' ? '#E3F5F5' : '#F7F6F1',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>🏥</span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: area === 'ART' ? '#0B7285' : '#131C2E',
                    }}
                  >
                    ART
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#7B8799' }}>
                  Aseguradora de riesgos del trabajo
                </p>
              </div>
            </div>
          </Card>

          {/* Card C: Abogado responsable */}
          <Card>
            <SectionLabel>3. Abogado</SectionLabel>
            <select
              value={abogadoId}
              onChange={(e) => setAbogadoId(Number(e.target.value))}
              style={{
                width: '100%',
                height: 44,
                border: '1.5px solid #E5E2D8',
                borderRadius: 8,
                background: '#FAFAF7',
                fontSize: 13,
                padding: '0 12px',
                color: '#131C2E',
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {ABOGADOS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Card>
        </div>

        {/* RIGHT COLUMN — Resumen */}
        <Card style={{ position: 'sticky', top: 20 }}>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 15,
              fontWeight: 700,
              color: '#131C2E',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Resumen
          </p>

          {[
            {
              label: 'Cliente',
              value: clienteSeleccionado ? MOCK_CLIENT.nombre : '—',
            },
            {
              label: 'Área',
              value: area === 'LABORAL' ? 'Laboral' : area === 'ART' ? 'ART' : '—',
            },
            { label: 'Abogado', value: abogadoLabel },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                borderBottom: '1px solid #F2F0EA',
                padding: '10px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, color: '#7B8799', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: row.value === '—' ? '#9BA8B8' : '#131C2E',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}

          <button
            disabled={!canCreate}
            style={{
              width: '100%',
              height: 44,
              marginTop: 16,
              background: '#1B3A6B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              cursor: canCreate ? 'pointer' : 'not-allowed',
              opacity: canCreate ? 1 : 0.5,
              transition: 'opacity 0.2s',
            }}
          >
            Crear caso
          </button>

          <button
            onClick={() => navigate('/casos')}
            style={{
              width: '100%',
              height: 40,
              marginTop: 8,
              background: '#F2F0EA',
              color: '#5A6478',
              border: '1px solid #D8D4CA',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </Card>
      </div>
    </div>
  );
}
