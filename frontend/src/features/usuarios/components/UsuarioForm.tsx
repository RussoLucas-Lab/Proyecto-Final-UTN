/**
 * Formulario de alta y edición de usuarios.
 *
 * En modo alta incluye el campo de contraseña inicial.
 * En modo edición omite email y contraseña (inmutables en el MVP).
 * Mensajes en español (AR), validación en cliente como primera defensa.
 */
import React, { useEffect, useState } from 'react';
import type { Area, Rol } from '../../../shared/types';
import type { Usuario, UsuarioCreate, UsuarioUpdate } from '../types';

interface UsuarioFormProps {
  /** Usuario a editar; undefined significa modo alta. */
  usuario?: Usuario;
  onGuardar: (datos: UsuarioCreate | UsuarioUpdate) => Promise<void>;
  onCancelar: () => void;
}

const AREA_LABELS: Record<Area, string> = {
  LABORAL: 'Laboral',
  ART: 'ART',
};

export default function UsuarioForm({ usuario, onGuardar, onCancelar }: UsuarioFormProps) {
  const esEdicion = usuario !== undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('ABOGADO');
  const [area, setArea] = useState<Area | null>('LABORAL');
  const [matricula, setMatricula] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  // Pre-llenar en modo edición
  useEffect(() => {
    if (usuario) {
      setNombre(usuario.nombre);
      setRol(usuario.rol);
      setArea(usuario.area);
      setMatricula(usuario.matricula ?? '');
    }
  }, [usuario]);

  // Al cambiar rol, ajustar área (SOCIO no requiere área)
  function handleRolChange(nuevoRol: Rol) {
    setRol(nuevoRol);
    if (nuevoRol === 'SOCIO') setArea(null);
    else if (area === null) setArea('LABORAL');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMensaje(null);

    // Validación básica en cliente
    if (!nombre.trim()) {
      setErrorMensaje('El nombre es obligatorio.');
      return;
    }
    if (rol === 'ABOGADO' && !area) {
      setErrorMensaje('El área es obligatoria para el rol Abogado.');
      return;
    }
    if (!esEdicion && !email.trim()) {
      setErrorMensaje('El email es obligatorio.');
      return;
    }
    if (!esEdicion && !password.trim()) {
      setErrorMensaje('La contraseña es obligatoria.');
      return;
    }

    setGuardando(true);
    try {
      const datos = esEdicion
        ? ({ nombre: nombre.trim(), rol, area, matricula: matricula.trim() || null } satisfies UsuarioUpdate)
        : ({
            email: email.trim(),
            password,
            nombre: nombre.trim(),
            rol,
            area,
            matricula: matricula.trim() || null,
          } satisfies UsuarioCreate);
      await onGuardar(datos);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409') || msg.toLowerCase().includes('email')) {
        setErrorMensaje('El email ya está registrado. Usá otro.');
      } else if (msg.includes('422')) {
        setErrorMensaje('Datos inválidos. Verificá el área para el rol Abogado.');
      } else if (msg.includes('403')) {
        setErrorMensaje('No tenés permiso para realizar esta acción.');
      } else {
        setErrorMensaje('Ocurrió un error. Intentá de nuevo.');
      }
    } finally {
      setGuardando(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '8px 12px',
    border: '1.5px solid #E5E2D8', borderRadius: 6, fontSize: 14,
    color: '#131C2E', background: '#FAFAF7', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#7B8799', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  const fieldStyle: React.CSSProperties = { marginBottom: 16 };

  return (
    <form onSubmit={handleSubmit} style={{ minWidth: 340 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#131C2E' }}>
        {esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
      </h3>

      {errorMensaje && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
          padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991B1B',
        }}>
          {errorMensaje}
        </div>
      )}

      {!esEdicion && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="abogado@estudio.test"
            required
            style={inputStyle}
          />
        </div>
      )}

      {!esEdicion && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Contraseña inicial</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="El abogado deberá cambiarla al primer acceso"
            required
            minLength={1}
            style={inputStyle}
          />
        </div>
      )}

      <div style={fieldStyle}>
        <label style={labelStyle}>Nombre completo</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre Apellido"
          required
          style={inputStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Rol</label>
        <select
          value={rol}
          onChange={(e) => handleRolChange(e.target.value as Rol)}
          style={inputStyle}
        >
          <option value="ABOGADO">Abogado</option>
          <option value="SOCIO">Socio</option>
        </select>
      </div>

      {rol === 'ABOGADO' && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Área</label>
          <select
            value={area ?? ''}
            onChange={(e) => setArea(e.target.value as Area)}
            required
            style={inputStyle}
          >
            {(Object.keys(AREA_LABELS) as Area[]).map((a) => (
              <option key={a} value={a}>{AREA_LABELS[a]}</option>
            ))}
          </select>
        </div>
      )}

      <div style={fieldStyle}>
        <label style={labelStyle}>Matrícula (opcional)</label>
        <input
          type="text"
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
          placeholder="MZA-1234"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          style={{
            padding: '8px 18px', borderRadius: 6, border: '1.5px solid #E5E2D8',
            background: 'white', fontSize: 13, cursor: 'pointer', color: '#7B8799',
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          style={{
            padding: '8px 18px', borderRadius: 6, border: 'none',
            background: '#1B3A6B', color: 'white', fontSize: 13,
            fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer',
            opacity: guardando ? 0.7 : 1,
          }}
        >
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}
