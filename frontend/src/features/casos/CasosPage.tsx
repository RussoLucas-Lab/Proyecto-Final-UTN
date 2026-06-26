import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCasos } from './hooks/useCasos';
import type { AreaDerecho, Caso } from './types';

type AreaFilter = 'Todos' | 'LABORAL' | 'ART';

const AREA_LABEL: Record<AreaDerecho, string> = {
  LABORAL: 'Laboral',
  ART: 'ART',
};

const AREA_BADGE: Record<AreaDerecho, { bg: string; color: string }> = {
  LABORAL: { bg: '#E8EDF8', color: '#1B3A6B' },
  ART: { bg: '#E3F5F5', color: '#0B7285' },
};

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

function iniciales(nombre: string | undefined): string {
  if (!nombre) return '??';
  const partes = nombre.split(/[\s,]+/).filter(Boolean);
  if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}

function formatFecha(iso: string): string {
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

export default function CasosPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AreaFilter>('Todos');
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const { casos, isLoading, error, recargar } = useCasos();

  const tabs: Array<{ key: AreaFilter; label: string }> = [
    { key: 'Todos', label: 'Todos' },
    { key: 'LABORAL', label: 'Laboral' },
    { key: 'ART', label: 'ART' },
  ];

  // Filtrar por área y búsqueda local (expediente)
  const filtered = casos.filter((c) => {
    if (activeTab !== 'Todos' && c.area !== activeTab) return false;
    if (busqueda && c.codigo_expediente) {
      return c.codigo_expediente.toLowerCase().includes(busqueda.toLowerCase());
    }
    return true;
  });

  function handleVer(caso: Caso) {
    const ruta = caso.area === 'LABORAL' ? `/casos/${caso.id}/laboral` : `/casos/${caso.id}/art`;
    navigate(ruta);
  }

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
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7B8799' }}>
            {isLoading ? 'Cargando…' : `${casos.length} casos en total`}
          </p>
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
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                background: activeTab === key ? '#FFFFFF' : 'transparent',
                boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: activeTab === key ? '#131C2E' : '#7B8799',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: activeTab === key ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search by expediente */}
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por expediente..."
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

      {/* Error state */}
      {error && (
        <div
          style={{
            marginTop: 12,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            color: '#991B1B',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Error al cargar casos: {error}.{' '}
          <button
            onClick={() => void recargar()}
            style={{
              background: 'none',
              border: 'none',
              color: '#1B3A6B',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Reintentar
          </button>
        </div>
      )}

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
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9BA8B8', fontSize: 14 }}>
            Cargando casos…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9BA8B8', fontSize: 14 }}>
            No hay casos{activeTab !== 'Todos' ? ` en el área ${AREA_LABEL[activeTab as AreaDerecho]}` : ''}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAF7', borderBottom: '2px solid #E5E2D8' }}>
                {['Cliente', 'Área', 'Expediente', 'Etapa', 'Alta', ''].map((col) => (
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
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((caso) => {
                const areaBadge = AREA_BADGE[caso.area];
                const avatarBg = areaBadge.bg;
                const avatarColor = areaBadge.color;
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
                            background: avatarBg,
                            color: avatarColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {iniciales(`C${caso.cliente_id}`)}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#131C2E' }}>
                          Cliente #{caso.cliente_id}
                        </span>
                      </div>
                    </td>

                    {/* Área */}
                    <td style={{ padding: '12px 16px' }}>
                      <Badge bg={areaBadge.bg} color={areaBadge.color}>
                        {AREA_LABEL[caso.area]}
                      </Badge>
                    </td>

                    {/* Expediente */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#5A6478' }}>
                        {caso.codigo_expediente ?? '—'}
                      </span>
                    </td>

                    {/* Etapa */}
                    <td style={{ padding: '12px 16px' }}>
                      <Badge bg={areaBadge.bg} color={areaBadge.color}>
                        Etapa {caso.etapa_actual_id}
                      </Badge>
                    </td>

                    {/* Alta */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 13, color: '#7B8799' }}>
                        {formatFecha(caso.creado_en)}
                      </span>
                    </td>

                    {/* Ver */}
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleVer(caso)}
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
        )}
      </div>
    </div>
  );
}
