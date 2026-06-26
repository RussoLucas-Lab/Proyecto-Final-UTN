/**
 * Formulario de admisión de cliente.
 *
 * Usado tanto para alta (ClienteCreate) como para edición (ClienteUpdate).
 * Maneja errores de la API: 409 DNI duplicado, 422 validación.
 * Mensajes en español (AR).
 */
import React, { useState } from 'react';
import type { Cliente, ClienteCreate, ClienteUpdate } from '../types';

interface ClienteFormProps {
  /** Si se pasa, el formulario opera en modo edición. */
  cliente?: Cliente;
  onGuardar: (datos: ClienteCreate | ClienteUpdate) => Promise<void>;
  onCancelar: () => void;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: 11,
  color: '#5A6478',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  border: '1.5px solid #E5E2D8',
  borderRadius: 6,
  background: '#FAFAF7',
  padding: '0 10px',
  fontSize: 13,
  color: '#131C2E',
  fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
  outline: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {children}
    </div>
  );
}

export default function ClienteForm({ cliente, onGuardar, onCancelar }: ClienteFormProps) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [dni, setDni] = useState(cliente?.dni ?? '');
  const [cuil, setCuil] = useState(cliente?.cuil ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '');
  const [email, setEmail] = useState(cliente?.email ?? '');
  const [domicilioReal, setDomicilioReal] = useState(cliente?.domicilio_real ?? '');
  const [domicilioCp, setDomicilioCp] = useState(cliente?.domicilio_real_cp ?? '');
  const [domicilioLocalidad, setDomicilioLocalidad] = useState(cliente?.domicilio_real_localidad ?? '');
  const [domicilioProvincia, setDomicilioProvincia] = useState(cliente?.domicilio_real_provincia ?? '');
  const [coincideDni, setCoincideDni] = useState(cliente?.domicilio_coincide_dni ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!dni.trim()) { setError('El DNI es obligatorio.'); return; }

    const datos: ClienteCreate = {
      nombre: nombre.trim(),
      dni: dni.trim(),
      cuil: cuil.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      domicilio_real: domicilioReal.trim() || null,
      domicilio_real_cp: domicilioCp.trim() || null,
      domicilio_real_localidad: domicilioLocalidad.trim() || null,
      domicilio_real_provincia: domicilioProvincia.trim() || null,
      domicilio_coincide_dni: coincideDni,
    };

    setSaving(true);
    setError(null);
    try {
      await onGuardar(datos);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409')) {
        setError('El DNI ingresado ya está registrado para otro cliente.');
      } else if (msg.includes('422')) {
        setError('Datos inválidos. Verificá el formato del email o los campos obligatorios.');
      } else {
        setError('Error al guardar. Intentá de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#131C2E', fontFamily: "'Inter', sans-serif" }}>
        {cliente ? 'Editar cliente' : 'Nuevo cliente'}
      </h2>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
          padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#991B1B',
          fontFamily: "'Inter', sans-serif",
        }}>
          {error}
        </div>
      )}

      <Row>
        <Field label="Nombre completo *">
          <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Apellido, Nombre" required />
        </Field>
        <Field label="DNI *">
          <input style={inputStyle} value={dni} onChange={e => setDni(e.target.value)} placeholder="Ej: 28456123" required />
        </Field>
      </Row>

      <Row>
        <Field label="CUIL">
          <input style={inputStyle} value={cuil} onChange={e => setCuil(e.target.value)} placeholder="20-28456123-4" />
        </Field>
        <Field label="Teléfono">
          <input style={inputStyle} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 261 4567890" />
        </Field>
      </Row>

      <Field label="Email">
        <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
      </Field>

      <Field label="Domicilio real">
        <input style={inputStyle} value={domicilioReal} onChange={e => setDomicilioReal(e.target.value)} placeholder="Calle, número, piso" />
      </Field>

      <Row>
        <Field label="Código postal">
          <input style={inputStyle} value={domicilioCp} onChange={e => setDomicilioCp(e.target.value)} placeholder="5500" />
        </Field>
        <Field label="Localidad">
          <input style={inputStyle} value={domicilioLocalidad} onChange={e => setDomicilioLocalidad(e.target.value)} placeholder="Mendoza" />
        </Field>
      </Row>

      <Field label="Provincia">
        <input style={inputStyle} value={domicilioProvincia} onChange={e => setDomicilioProvincia(e.target.value)} placeholder="Mendoza" />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#5A6478', marginBottom: 18 }}>
        <input type="checkbox" checked={coincideDni} onChange={() => setCoincideDni(v => !v)} style={{ width: 15, height: 15, accentColor: '#1B3A6B' }} />
        El domicilio real coincide con el del DNI
      </label>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancelar}
          style={{ padding: '8px 16px', borderRadius: 7, border: '1.5px solid #E5E2D8', background: 'white', color: '#5A6478', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#1B3A6B', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Guardando…' : (cliente ? 'Guardar cambios' : 'Crear cliente')}
        </button>
      </div>
    </form>
  );
}
