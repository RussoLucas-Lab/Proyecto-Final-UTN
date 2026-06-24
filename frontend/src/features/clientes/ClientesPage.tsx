import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── helpers ────────────────────────────────────────────────────────────────

const badge = (bg: string, color: string, text: string) => (
  <span style={{ background: bg, color, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' as const }}>{text}</span>
);

function Initials({ letters, bg, color }: { letters: string; bg: string; color: string }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', background: bg, color,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 11,
      flexShrink: 0, marginRight: 10,
    }}>
      {letters}
    </div>
  );
}

// ── mock data ───────────────────────────────────────────────────────────────

const CLIENTES = [
  { id: 1, initials: 'GP', bg: '#E8EDF8', color: '#1B3A6B', nombre: 'González Pérez, Carlos', dni: '28.456.123', area: 'Laboral', etapa: 'Telegrama 1', abogado: 'Dra. Romero', casoPath: '/casos/1/laboral' },
  { id: 2, initials: 'MR', bg: '#E3F5F5', color: '#0B7285', nombre: 'Martínez Rojas, Ana', dni: '31.782.004', area: 'ART', etapa: 'Denuncia ART', abogado: 'Dr. Ferreyra', casoPath: '/casos/2/art' },
  { id: 3, initials: 'DF', bg: '#E8EDF8', color: '#1B3A6B', nombre: 'Díaz Fuentes, Roberto', dni: '25.019.876', area: 'Laboral', etapa: 'Conciliación', abogado: 'Dra. Romero', casoPath: '/casos/3/laboral' },
  { id: 4, initials: 'VL', bg: '#E3F5F5', color: '#0B7285', nombre: 'Vega López, Sofía', dni: '33.110.452', area: 'ART', etapa: 'Comisión médica', abogado: 'Dr. Ferreyra', casoPath: '/casos/4/art' },
  { id: 5, initials: 'TC', bg: '#E8EDF8', color: '#1B3A6B', nombre: 'Torres Cano, Miguel', dni: '29.543.788', area: 'Laboral', etapa: 'Telegrama 2', abogado: 'Dra. Romero', casoPath: '/casos/5/laboral' },
  { id: 6, initials: 'RB', bg: '#E3F5F5', color: '#0B7285', nombre: 'Ríos Blanco, Claudia', dni: '27.334.901', area: 'ART', etapa: 'Alta médica', abogado: 'Dr. Ferreyra', casoPath: '/casos/6/art' },
  { id: 7, initials: 'PN', bg: '#E8EDF8', color: '#1B3A6B', nombre: 'Pérez Navarro, Héctor', dni: '22.876.543', area: 'Laboral', etapa: 'Audiencia', abogado: 'Dra. Romero', casoPath: '/casos/7/laboral' },
  { id: 8, initials: 'SO', bg: '#E3F5F5', color: '#0B7285', nombre: 'Soria Olmedo, Lucía', dni: '35.221.067', area: 'ART', etapa: 'Incapacidad', abogado: 'Dr. Ferreyra', casoPath: '/casos/8/art' },
];

const areaBadge = (area: string) =>
  area === 'Laboral'
    ? badge('#E8EDF8', '#1B3A6B', 'Laboral')
    : badge('#E3F5F5', '#0B7285', 'ART');

const etapaBadge = (etapa: string) =>
  badge('#F2F0EA', '#5A6478', etapa);

// ── component ───────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const filtered = CLIENTES.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.dni.includes(search)
  );

  const thStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: 11,
    color: '#7B8799',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '11px 16px',
    background: '#FAFAF7',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#F2F0EA', minHeight: '100vh', padding: '32px 32px 48px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0 }}>
            Clientes
          </h1>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#7B8799' }}>
            48 clientes
          </span>
        </div>
        <button
          onClick={() => navigate('/clientes/nuevo')}
          style={{ background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          + Ingresar cliente
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 10, padding: '12px 16px', marginTop: 20 }}>
        <input
          type="text"
          placeholder="Buscar por nombre o DNI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', height: 38, border: '1.5px solid #E5E2D8', borderRadius: 7,
            background: '#FAFAF7', padding: '0 12px', fontSize: 13, color: '#131C2E',
            fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      {/* Table card */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, marginTop: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>DNI</th>
              <th style={thStyle}>Área</th>
              <th style={thStyle}>Etapa</th>
              <th style={thStyle}>Abogado</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const isLast = i === filtered.length - 1;
              const isHovered = hoveredRow === c.id;
              const tdBase: React.CSSProperties = {
                padding: '12px 16px',
                borderBottom: isLast ? 'none' : '1px solid #F2F0EA',
                verticalAlign: 'middle',
                background: isHovered ? '#FAFAF7' : '#FFFFFF',
                transition: 'background 0.12s',
              };
              return (
                <tr
                  key={c.id}
                  onMouseEnter={() => setHoveredRow(c.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {/* Nombre */}
                  <td style={tdBase}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Initials letters={c.initials} bg={c.bg} color={c.color} />
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: '#131C2E' }}>
                        {c.nombre}
                      </span>
                    </div>
                  </td>
                  {/* DNI */}
                  <td style={tdBase}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#5A6478' }}>{c.dni}</span>
                  </td>
                  {/* Área */}
                  <td style={tdBase}>{areaBadge(c.area)}</td>
                  {/* Etapa */}
                  <td style={tdBase}>{etapaBadge(c.etapa)}</td>
                  {/* Abogado */}
                  <td style={{ ...tdBase, fontSize: 13, color: '#5A6478' }}>{c.abogado}</td>
                  {/* Acciones */}
                  <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => navigate(c.casoPath)}
                      style={{
                        background: 'transparent', color: '#1B3A6B', border: '1px solid #1B3A6B',
                        borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginRight: 6,
                      }}
                    >
                      Ver caso
                    </button>
                    <button
                      style={{
                        background: '#F2F0EA', color: '#5A6478', border: '1px solid #D8D4CA',
                        borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#7B8799', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
            No se encontraron clientes para la búsqueda.
          </div>
        )}
      </div>
    </div>
  );
}
