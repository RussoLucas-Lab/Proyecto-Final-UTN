import { useState } from 'react';

interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: 'Socio' | 'Abogado';
  area: 'Laboral' | 'ART' | null;
  matricula: string | null;
  estado: 'Activo' | 'Inactivo';
}

const mockUsuarios: Usuario[] = [
  { id: 1, nombre: 'Dr. Martín Suárez', correo: 'msuarez@iuris.com.ar', rol: 'Socio', area: null, matricula: 'MP 1234', estado: 'Activo' },
  { id: 2, nombre: 'Dra. Laura Vega', correo: 'lvega@iuris.com.ar', rol: 'Abogado', area: 'Laboral', matricula: 'MP 5678', estado: 'Activo' },
  { id: 3, nombre: 'Dr. Pablo Rossi', correo: 'prossi@iuris.com.ar', rol: 'Abogado', area: 'ART', matricula: 'MP 9012', estado: 'Activo' },
  { id: 4, nombre: 'Lic. Ana Torres', correo: 'atorres@iuris.com.ar', rol: 'Abogado', area: 'Laboral', matricula: 'MP 3456', estado: 'Activo' },
  { id: 5, nombre: 'Sr. Diego López', correo: 'dlopez@iuris.com.ar', rol: 'Abogado', area: 'ART', matricula: null, estado: 'Inactivo' },
  { id: 6, nombre: 'Sra. María Gómez', correo: 'mgomez@iuris.com.ar', rol: 'Abogado', area: 'Laboral', matricula: null, estado: 'Activo' },
];

function getInitials(nombre: string): string {
  const parts = nombre.replace(/^(Dr\.|Dra\.|Lic\.|Sr\.|Sra\.)\s+/, '').split(' ');
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function getAvatarBg(area: 'Laboral' | 'ART' | null, rol: 'Socio' | 'Abogado'): string {
  if (area === 'ART') return '#E3F5F5';
  return '#E8EDF8';
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: '#5A6478',
  marginBottom: 5,
  letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  border: '1.5px solid #E5E2D8',
  borderRadius: 7,
  background: '#FAFAF7',
  padding: '0 12px',
  fontSize: 13,
  fontFamily: 'Inter, sans-serif',
  color: '#131C2E',
  boxSizing: 'border-box',
  outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  background: '#1B3A6B',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
};

const btnSecondary: React.CSSProperties = {
  background: '#F2F0EA',
  color: '#5A6478',
  border: '1px solid #D8D4CA',
  borderRadius: 8,
  padding: '9px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
};

const colHeaders = ['Nombre', 'Correo', 'Rol', 'Área', 'Matrícula', 'Estado', 'Acciones'];

export default function UsuariosPage() {
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [matricula, setMatricula] = useState('');
  const [rol, setRol] = useState<'Socio' | 'Abogado'>('Abogado');
  const [area, setArea] = useState<'Laboral' | 'ART' | ''>('');

  function handleCancelar() {
    setShowForm(false);
    setNombre('');
    setCorreo('');
    setMatricula('');
    setRol('Abogado');
    setArea('');
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#131C2E', padding: '32px 36px', maxWidth: 1100 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0, lineHeight: 1.2 }}>
            Usuarios
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7B8799', fontFamily: 'Inter, sans-serif' }}>
            Gestión de accesos del estudio
          </p>
        </div>
        <button
          style={btnPrimary}
          onClick={() => setShowForm(v => !v)}
        >
          + Nuevo usuario
        </button>
      </div>

      {/* Users table card */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E2D8',
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 24,
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 220px 110px 110px 120px 100px 160px',
          background: '#FAFAF7',
          borderBottom: '2px solid #E5E2D8',
        }}>
          {colHeaders.map(h => (
            <div key={h} style={{
              padding: '11px 16px',
              fontSize: 11,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#7B8799',
              letterSpacing: '0.04em',
            }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {mockUsuarios.map((u, idx) => (
          <div
            key={u.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '200px 220px 110px 110px 120px 100px 160px',
              borderBottom: idx < mockUsuarios.length - 1 ? '1px solid #F2F0EA' : 'none',
              alignItems: 'center',
            }}
          >
            {/* Nombre */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: getAvatarBg(u.area, u.rol),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: u.area === 'ART' ? '#0B7285' : '#1B3A6B',
                flexShrink: 0,
                fontFamily: 'Inter, sans-serif',
              }}>
                {getInitials(u.nombre)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
                {u.nombre}
              </span>
            </div>

            {/* Correo */}
            <div style={{ padding: '12px 16px', fontSize: 13, color: '#5A6478', fontFamily: 'Inter, sans-serif' }}>
              {u.correo}
            </div>

            {/* Rol badge */}
            <div style={{ padding: '12px 16px' }}>
              <span style={{
                display: 'inline-block',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                background: u.rol === 'Socio' ? '#FEF3E2' : '#EDE9F7',
                color: u.rol === 'Socio' ? '#B45309' : '#5B4A8A',
              }}>
                {u.rol}
              </span>
            </div>

            {/* Área badge */}
            <div style={{ padding: '12px 16px' }}>
              {u.area ? (
                <span style={{
                  display: 'inline-block',
                  padding: '3px 9px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  background: u.area === 'Laboral' ? '#E8EDF8' : '#E3F5F5',
                  color: u.area === 'Laboral' ? '#1B3A6B' : '#0B7285',
                }}>
                  {u.area}
                </span>
              ) : (
                <span style={{ color: '#7B8799', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>—</span>
              )}
            </div>

            {/* Matrícula */}
            <div style={{ padding: '12px 16px' }}>
              {u.matricula ? (
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#131C2E' }}>{u.matricula}</span>
              ) : (
                <span style={{ color: '#7B8799', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>—</span>
              )}
            </div>

            {/* Estado badge */}
            <div style={{ padding: '12px 16px' }}>
              <span style={{
                display: 'inline-block',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                background: u.estado === 'Activo' ? '#E6F4EE' : '#F2F0EA',
                color: u.estado === 'Activo' ? '#1A7A4A' : '#7B8799',
              }}>
                {u.estado}
              </span>
            </div>

            {/* Acciones */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={{
                ...btnSecondary,
                fontSize: 12,
                padding: '6px 12px',
              }}>
                Editar
              </button>
              {u.estado === 'Activo' && (
                <button style={{
                  background: '#FEE4E2',
                  color: '#C9423A',
                  border: '1px solid #F5C2C0',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  Desactivar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Alta de nuevo usuario form */}
      {showForm && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E2D8',
          borderRadius: 12,
          padding: 22,
          marginTop: 20,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: '#131C2E', marginBottom: 16 }}>
            Alta de nuevo usuario
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
          }}>
            {/* Nombre completo */}
            <div>
              <label style={labelStyle}>Nombre completo</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="Ej. Dr. Juan García"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
              />
            </div>

            {/* Correo electrónico */}
            <div>
              <label style={labelStyle}>Correo electrónico</label>
              <input
                type="email"
                style={inputStyle}
                placeholder="correo@iuris.com.ar"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
              />
            </div>

            {/* Matrícula */}
            <div>
              <label style={labelStyle}>Matrícula <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(opcional)</span></label>
              <input
                type="text"
                style={inputStyle}
                placeholder="MP 0000"
                value={matricula}
                onChange={e => setMatricula(e.target.value)}
              />
            </div>

            {/* Rol */}
            <div>
              <label style={labelStyle}>Rol</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={rol}
                onChange={e => setRol(e.target.value as 'Socio' | 'Abogado')}
              >
                <option value="Socio">Socio</option>
                <option value="Abogado">Abogado</option>
              </select>
            </div>

            {/* Área */}
            <div>
              <label style={labelStyle}>Área</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={area}
                onChange={e => setArea(e.target.value as 'Laboral' | 'ART' | '')}
              >
                <option value="">—</option>
                <option value="Laboral">Laboral</option>
                <option value="ART">ART</option>
              </select>
            </div>

            {/* Empty cell */}
            <div />
          </div>

          {/* Button row */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={btnPrimary}>
              Crear usuario
            </button>
            <button style={btnSecondary} onClick={handleCancelar}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
