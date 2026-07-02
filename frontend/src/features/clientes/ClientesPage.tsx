/**
 * Página de listado y búsqueda de clientes (RF-06, RF-07).
 *
 * Muestra la lista paginada con búsqueda por nombre o DNI.
 * Permite crear nuevos clientes y editar los existentes mediante un modal.
 * Lectura disponible para todo usuario autenticado (RN-08).
 * Mutaciones (alta/edición) requieren ABOGADO o SOCIO.
 *
 * Mensajes en español (AR) y manejo de errores (409, 404, 422).
 */
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClienteForm from './components/ClienteForm';
import { useClientes } from './hooks/useClientes';
import type { Cliente, ClienteCreate, ClienteUpdate } from './types';

// ── helpers ────────────────────────────────────────────────────────────────────

function Initials({ nombre }: { nombre: string }) {
  const parts = nombre.split(/[\s,]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const bg = '#E8EDF8';
  const color = '#1B3A6B';
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', background: bg, color,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 11,
      flexShrink: 0, marginRight: 10,
    }}>
      {letters || '?'}
    </div>
  );
}

type ModalState =
  | { tipo: 'cerrado' }
  | { tipo: 'alta' }
  | { tipo: 'edicion'; cliente: Cliente };

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

// ── component ───────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState>({ tipo: 'cerrado' });

  const { clientes, isLoading, error, recargar, crear, editar } = useClientes({ search, page });

  // Re-busca cuando cambia el texto de búsqueda
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
    void recargar({ search: value, page: 1 });
  }, [recargar]);

  async function handleGuardar(datos: ClienteCreate | ClienteUpdate) {
    if (modal.tipo === 'alta') {
      await crear(datos as ClienteCreate);
    } else if (modal.tipo === 'edicion') {
      await editar(modal.cliente.id, datos as ClienteUpdate);
    }
    setModal({ tipo: 'cerrado' });
    void recargar({ search, page });
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#F2F0EA', minHeight: '100vh', padding: '32px 32px 48px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0 }}>
            Clientes
          </h1>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#7B8799' }}>
            {clientes.length} resultado{clientes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => navigate('/clientes/nuevo')}
          style={{ background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          + Ingresar cliente
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 16px', marginTop: 16, fontSize: 13, color: '#991B1B', fontFamily: "'Inter', sans-serif" }}>
          {error}
        </div>
      )}

      {/* Buscador */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 10, padding: '12px 16px', marginTop: 20 }}>
        <input
          type="text"
          placeholder="Buscar por nombre o DNI…"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          style={{
            width: '100%', height: 38, border: '1.5px solid #E5E2D8', borderRadius: 7,
            background: '#FAFAF7', padding: '0 12px', fontSize: 13, color: '#131C2E',
            fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      {/* Tabla */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, marginTop: 16, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9BA8B8', fontSize: 14, fontFamily: "'Inter', sans-serif" }}>
            Cargando clientes…
          </div>
        ) : clientes.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9BA8B8', fontSize: 14, fontFamily: "'Inter', sans-serif" }}>
            {search ? 'No se encontraron clientes para la búsqueda.' : 'No hay clientes registrados todavía.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nombre', 'DNI', 'CUIL', 'Teléfono', 'Domicilio', 'Acciones'].map(col => (
                  <th key={col} style={thStyle}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => {
                const isLast = i === clientes.length - 1;
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
                    <td style={tdBase}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Initials nombre={c.nombre} />
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#131C2E', fontFamily: "'Inter', sans-serif" }}>
                          {c.nombre}
                        </span>
                      </div>
                    </td>
                    <td style={tdBase}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#5A6478' }}>{c.dni}</span>
                    </td>
                    <td style={{ ...tdBase, fontSize: 12, color: '#5A6478' }}>
                      {c.cuil ?? '—'}
                    </td>
                    <td style={{ ...tdBase, fontSize: 13, color: '#5A6478' }}>
                      {c.telefono ?? '—'}
                    </td>
                    <td style={{ ...tdBase, fontSize: 12, color: '#5A6478', maxWidth: 200 }}>
                      {c.domicilio_real
                        ? [c.domicilio_real, c.domicilio_real_localidad, c.domicilio_real_provincia].filter(Boolean).join(', ')
                        : '—'}
                    </td>
                    <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setModal({ tipo: 'edicion', cliente: c })}
                        style={{
                          background: 'transparent', color: '#1B3A6B', border: '1px solid #1B3A6B',
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
        )}
      </div>

      {/* Paginación simple */}
      {!isLoading && clientes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => { const p = Math.max(1, page - 1); setPage(p); void recargar({ search, page: p }); }}
            disabled={page === 1}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #E5E2D8', background: 'white', color: page === 1 ? '#C0C9D4' : '#1B3A6B', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Anterior
          </button>
          <span style={{ padding: '6px 10px', fontSize: 12, color: '#7B8799', fontFamily: "'Inter', sans-serif" }}>
            Página {page}
          </span>
          <button
            onClick={() => { const p = page + 1; setPage(p); void recargar({ search, page: p }); }}
            disabled={clientes.length < 20}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #E5E2D8', background: 'white', color: clientes.length < 20 ? '#C0C9D4' : '#1B3A6B', cursor: clientes.length < 20 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal alta/edición */}
      {modal.tipo !== 'cerrado' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) setModal({ tipo: 'cerrado' }); }}
        >
          <div style={{ background: 'white', borderRadius: 12, padding: '28px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <ClienteForm
              cliente={modal.tipo === 'edicion' ? modal.cliente : undefined}
              onGuardar={handleGuardar}
              onCancelar={() => setModal({ tipo: 'cerrado' })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
