/**
 * Página de gestión de usuarios — solo SOCIO (RF-03, RN-07).
 *
 * Muestra el listado de usuarios (nombre, email, rol, área, matrícula, estado)
 * con acciones de alta, edición y toggle de activación.
 * La ruta está protegida con <RequireSocio> en App.tsx; esta página asume
 * que el usuario logueado es SOCIO.
 *
 * Mensajes en español (AR) y manejo de errores de API (409/403/422).
 */
import React, { useState } from 'react';
import type { Area, Rol } from '../../shared/types';
import UsuarioForm from './components/UsuarioForm';
import { useUsuarios } from './hooks/useUsuarios';
import type { Usuario, UsuarioCreate, UsuarioUpdate } from './types';

const ROL_LABELS: Record<Rol, string> = {
  SOCIO: 'Socio',
  ABOGADO: 'Abogado',
};

const AREA_LABELS: Record<Area, string> = {
  LABORAL: 'Laboral',
  ART: 'ART',
};

type ModalState =
  | { tipo: 'cerrado' }
  | { tipo: 'alta' }
  | { tipo: 'edicion'; usuario: Usuario };

export default function UsuariosPage() {
  const { usuarios, isLoading, error, crear, editar, cambiarActivacion } = useUsuarios();
  const [modal, setModal] = useState<ModalState>({ tipo: 'cerrado' });
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function handleGuardar(datos: UsuarioCreate | UsuarioUpdate) {
    if (modal.tipo === 'alta') {
      await crear(datos as UsuarioCreate);
    } else if (modal.tipo === 'edicion') {
      await editar(modal.usuario.id, datos as UsuarioUpdate);
    }
    setModal({ tipo: 'cerrado' });
  }

  async function handleToggleActivacion(usuario: Usuario) {
    setTogglingId(usuario.id);
    setToggleError(null);
    try {
      await cambiarActivacion(usuario.id, { activo: !usuario.activo });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409')) {
        setToggleError('No podés desactivar tu propia cuenta.');
      } else if (msg.includes('403')) {
        setToggleError('Sin permiso para realizar esta acción.');
      } else {
        setToggleError('Error al cambiar el estado. Intentá de nuevo.');
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#131C2E' }}>Usuarios</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7B8799' }}>
            Gestión de acceso al sistema — solo socios
          </p>
        </div>
        <button
          onClick={() => setModal({ tipo: 'alta' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: '#1B3A6B', color: 'white', fontSize: 13,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          Nuevo usuario
        </button>
      </div>

      {/* Error de toggle */}
      {toggleError && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#991B1B',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {toggleError}
          <button
            onClick={() => setToggleError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Error de carga */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#991B1B',
        }}>
          {error}
        </div>
      )}

      {/* Tabla de usuarios */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E9E6DE', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9BA8B8', fontSize: 14 }}>
            Cargando usuarios…
          </div>
        ) : usuarios.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9BA8B8', fontSize: 14 }}>
            No hay usuarios registrados todavía.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #E9E6DE' }}>
                {['Nombre', 'Email', 'Rol', 'Área', 'Matrícula', 'Estado', 'Acciones'].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                      color: '#7B8799', textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: '1px solid #F0EDE6',
                    background: u.activo ? 'white' : '#FAFAF7',
                    opacity: u.activo ? 1 : 0.7,
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#131C2E' }}>
                    {u.nombre}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4B5563' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11,
                      fontWeight: 700, letterSpacing: '0.3px',
                      background: u.rol === 'SOCIO' ? '#EFF6FF' : '#F0FDF4',
                      color: u.rol === 'SOCIO' ? '#1D4ED8' : '#15803D',
                    }}>
                      {ROL_LABELS[u.rol]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4B5563' }}>
                    {u.area ? AREA_LABELS[u.area] : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4B5563' }}>
                    {u.matricula ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: u.activo ? '#DCFCE7' : '#FEE2E2',
                      color: u.activo ? '#166534' : '#991B1B',
                    }}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setModal({ tipo: 'edicion', usuario: u })}
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          border: '1.5px solid #E5E2D8', background: 'white', cursor: 'pointer',
                          color: '#1B3A6B',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => void handleToggleActivacion(u)}
                        disabled={togglingId === u.id}
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          border: 'none', cursor: togglingId === u.id ? 'not-allowed' : 'pointer',
                          background: u.activo ? '#FEE2E2' : '#DCFCE7',
                          color: u.activo ? '#991B1B' : '#166534',
                          opacity: togglingId === u.id ? 0.6 : 1,
                        }}
                      >
                        {togglingId === u.id
                          ? '…'
                          : u.activo
                          ? 'Desactivar'
                          : 'Reactivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de alta/edición */}
      {modal.tipo !== 'cerrado' && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal({ tipo: 'cerrado' }); }}
        >
          <div style={{
            background: 'white', borderRadius: 12, padding: '28px 32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)', minWidth: 400, maxWidth: 480,
          }}>
            <UsuarioForm
              usuario={modal.tipo === 'edicion' ? modal.usuario : undefined}
              onGuardar={handleGuardar}
              onCancelar={() => setModal({ tipo: 'cerrado' })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
