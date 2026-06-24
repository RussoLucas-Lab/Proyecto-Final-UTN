import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type AreaFilter = 'Todos' | 'Laboral' | 'ART';

interface MockCaso {
  id: number;
  clienteNombre: string;
  clienteIniciales: string;
  area: 'Laboral' | 'ART';
  expediente: string;
  etapa: string;
  etapaBg: string;
  etapaColor: string;
  abogado: string;
  ultimoMov: string;
  detailRoute: string;
}

const MOCK_CASOS: MockCaso[] = [
  {
    id: 1,
    clienteNombre: 'González Pérez, Carlos',
    clienteIniciales: 'GP',
    area: 'Laboral',
    expediente: 'EXP-2026-000042',
    etapa: 'Telegrama 1',
    etapaBg: '#E8EDF8',
    etapaColor: '#1B3A6B',
    abogado: 'Dra. Laura Vega',
    ultimoMov: 'hace 2 días',
    detailRoute: '/casos/1/laboral',
  },
  {
    id: 2,
    clienteNombre: 'Martínez Rojas, Ana',
    clienteIniciales: 'MR',
    area: 'ART',
    expediente: 'EXP-2026-000055',
    etapa: 'Denuncia ART',
    etapaBg: '#E3F5F5',
    etapaColor: '#0B7285',
    abogado: 'Dr. Pablo Rossi',
    ultimoMov: 'hace 1 día',
    detailRoute: '/casos/2/art',
  },
  {
    id: 3,
    clienteNombre: 'Romero, Beatriz',
    clienteIniciales: 'BR',
    area: 'Laboral',
    expediente: 'EXP-2026-000031',
    etapa: 'Conciliación',
    etapaBg: '#FEF3E2',
    etapaColor: '#B45309',
    abogado: 'Dr. Martín Suárez',
    ultimoMov: 'hace 4 días',
    detailRoute: '/casos/3/laboral',
  },
  {
    id: 4,
    clienteNombre: 'López Fernández, Jorge',
    clienteIniciales: 'LF',
    area: 'ART',
    expediente: 'EXP-2026-000048',
    etapa: 'Comisión médica',
    etapaBg: '#E3F5F5',
    etapaColor: '#0B7285',
    abogado: 'Dr. Pablo Rossi',
    ultimoMov: 'hace 3 días',
    detailRoute: '/casos/4/art',
  },
  {
    id: 5,
    clienteNombre: 'Sánchez, Patricia',
    clienteIniciales: 'SP',
    area: 'Laboral',
    expediente: 'EXP-2025-000198',
    etapa: 'Juicio Inicial',
    etapaBg: '#EDE9F7',
    etapaColor: '#5B4A8A',
    abogado: 'Dra. Laura Vega',
    ultimoMov: 'hace 1 semana',
    detailRoute: '/casos/5/laboral',
  },
  {
    id: 6,
    clienteNombre: 'Torres Díaz, Manuel',
    clienteIniciales: 'TD',
    area: 'Laboral',
    expediente: 'EXP-2026-000019',
    etapa: 'Telegrama 2',
    etapaBg: '#E8EDF8',
    etapaColor: '#1B3A6B',
    abogado: 'Dr. Martín Suárez',
    ultimoMov: 'hace 5 días',
    detailRoute: '/casos/6/laboral',
  },
  {
    id: 7,
    clienteNombre: 'Herrera, Claudia',
    clienteIniciales: 'HC',
    area: 'ART',
    expediente: 'EXP-2025-000312',
    etapa: 'Comisión médica',
    etapaBg: '#E3F5F5',
    etapaColor: '#0B7285',
    abogado: 'Dr. Pablo Rossi',
    ultimoMov: 'hace 2 semanas',
    detailRoute: '/casos/7/art',
  },
  {
    id: 8,
    clienteNombre: 'Flores, Roberto',
    clienteIniciales: 'FR',
    area: 'Laboral',
    expediente: 'EXP-2025-000277',
    etapa: 'Acuerdo',
    etapaBg: '#E6F4EE',
    etapaColor: '#1A7A4A',
    abogado: 'Dra. Laura Vega',
    ultimoMov: 'hace 3 semanas',
    detailRoute: '/casos/8/laboral',
  },
  {
    id: 9,
    clienteNombre: 'Medina Castillo, Valeria',
    clienteIniciales: 'MC',
    area: 'Laboral',
    expediente: 'EXP-2026-000063',
    etapa: 'Telegrama 3',
    etapaBg: '#E8EDF8',
    etapaColor: '#1B3A6B',
    abogado: 'Dr. Martín Suárez',
    ultimoMov: 'hoy',
    detailRoute: '/casos/9/laboral',
  },
  {
    id: 10,
    clienteNombre: 'Aguilar, Néstor',
    clienteIniciales: 'AN',
    area: 'ART',
    expediente: 'EXP-2026-000071',
    etapa: 'Denuncia ART',
    etapaBg: '#E3F5F5',
    etapaColor: '#0B7285',
    abogado: 'Dr. Pablo Rossi',
    ultimoMov: 'hace 6 días',
    detailRoute: '/casos/10/art',
  },
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

function getAreaAvatarColors(area: 'Laboral' | 'ART') {
  return area === 'Laboral'
    ? { bg: '#E8EDF8', color: '#1B3A6B' }
    : { bg: '#E3F5F5', color: '#0B7285' };
}

export default function CasosPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AreaFilter>('Todos');
  const [hoverRow, setHoverRow] = useState<number | null>(null);

  const tabs: AreaFilter[] = ['Todos', 'Laboral', 'ART'];

  const filtered =
    activeTab === 'Todos'
      ? MOCK_CASOS
      : MOCK_CASOS.filter((c) => c.area === activeTab);

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
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: 26,
              color: '#131C2E',
              margin: 0,
            }}
          >
            Casos
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7B8799' }}>35 casos en total</p>
        </div>
        <button
          onClick={() => navigate('/casos/nuevo')}
          style={{
            background: '#1B3A6B',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Nuevo caso
        </button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          marginTop: 20,
          background: '#FFFFFF',
          border: '1px solid #E5E2D8',
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Segmented tabs */}
        <div
          style={{
            background: '#F2F0EA',
            borderRadius: 8,
            padding: 3,
            display: 'flex',
            gap: 2,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? '#FFFFFF' : 'transparent',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: activeTab === tab ? '#131C2E' : '#7B8799',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Etapa select */}
        <select
          style={{
            height: 36,
            border: '1.5px solid #E5E2D8',
            borderRadius: 7,
            background: '#FAFAF7',
            fontSize: 13,
            padding: '0 10px',
            color: '#131C2E',
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option>Todas las etapas</option>
          <option>Telegrama 1</option>
          <option>Telegrama 2</option>
          <option>Telegrama 3</option>
          <option>Conciliación</option>
          <option>Juicio Inicial</option>
          <option>Acuerdo</option>
          <option>Denuncia ART</option>
          <option>Comisión médica</option>
        </select>

        {/* Abogado select */}
        <select
          style={{
            height: 36,
            border: '1.5px solid #E5E2D8',
            borderRadius: 7,
            background: '#FAFAF7',
            fontSize: 13,
            padding: '0 10px',
            color: '#131C2E',
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option>Todos los abogados</option>
          <option>Dr. Martín Suárez</option>
          <option>Dra. Laura Vega</option>
          <option>Dr. Pablo Rossi</option>
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar por cliente o expediente..."
          style={{
            flex: 1,
            minWidth: 200,
            height: 36,
            border: '1.5px solid #E5E2D8',
            borderRadius: 7,
            background: '#FAFAF7',
            fontSize: 13,
            padding: '0 10px',
            color: '#131C2E',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
          }}
        />
      </div>

      {/* Table card */}
      <div
        style={{
          marginTop: 16,
          background: '#FFFFFF',
          border: '1px solid #E5E2D8',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAF7', borderBottom: '2px solid #E5E2D8' }}>
              {['Cliente', 'Área', 'Expediente', 'Etapa', 'Abogado', 'Último mov.', ''].map(
                (col) => (
                  <th
                    key={col}
                    style={{
                      padding: '11px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#7B8799',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((caso) => {
              const avatarColors = getAreaAvatarColors(caso.area);
              return (
                <tr
                  key={caso.id}
                  onMouseEnter={() => setHoverRow(caso.id)}
                  onMouseLeave={() => setHoverRow(null)}
                  style={{
                    borderBottom: '1px solid #F2F0EA',
                    background: hoverRow === caso.id ? '#FAFAF7' : '#FFFFFF',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Cliente */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: avatarColors.bg,
                          color: avatarColors.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {caso.clienteIniciales}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#131C2E' }}>
                        {caso.clienteNombre}
                      </span>
                    </div>
                  </td>

                  {/* Área */}
                  <td style={{ padding: '12px 16px' }}>
                    {caso.area === 'Laboral' ? (
                      <Badge bg="#E8EDF8" color="#1B3A6B">
                        Laboral
                      </Badge>
                    ) : (
                      <Badge bg="#E3F5F5" color="#0B7285">
                        ART
                      </Badge>
                    )}
                  </td>

                  {/* Expediente */}
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: '#5A6478',
                      }}
                    >
                      {caso.expediente}
                    </span>
                  </td>

                  {/* Etapa */}
                  <td style={{ padding: '12px 16px' }}>
                    <Badge bg={caso.etapaBg} color={caso.etapaColor}>
                      {caso.etapa}
                    </Badge>
                  </td>

                  {/* Abogado */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 13, color: '#131C2E' }}>{caso.abogado}</span>
                  </td>

                  {/* Último mov. */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 13, color: '#7B8799' }}>{caso.ultimoMov}</span>
                  </td>

                  {/* Ver */}
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => navigate(caso.detailRoute)}
                      style={{
                        background: '#F2F0EA',
                        color: '#1B3A6B',
                        border: '1px solid #C5D0E8',
                        borderRadius: 6,
                        padding: '5px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
