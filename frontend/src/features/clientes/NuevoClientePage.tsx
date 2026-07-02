/**
 * Página de admisión completa de un nuevo cliente (RF-05, UC-02).
 *
 * Formulario detallado con datos de la persona, contacto y domicilio real.
 * Al guardar, llama a POST /clientes y navega de vuelta al listado.
 * Mensajes en español (AR) y manejo de errores (409 DNI duplicado, 422).
 *
 * Nota: los "Datos del trabajo" y "Situación registral" pertenecen a la
 * ficha laboral del caso (RF-09), no al cliente. Esta sección queda como
 * referencia visual para el futuro; los datos del trabajo se enviarán al
 * crear el caso. Solo se persisten los datos del cliente en esta pantalla.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from './api';
import type { ClienteCreate } from './types';

// ── shared style helpers ────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: 11,
  color: '#5A6478',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  border: '1.5px solid #E5E2D8',
  borderRadius: 7,
  background: '#FAFAF7',
  padding: '0 12px',
  fontSize: 13,
  color: '#131C2E',
  fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
  outline: 'none',
};

// ── sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1B3A6B', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {num}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#1B3A6B', fontFamily: "'Inter', sans-serif" }}>
        {title}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, padding: 22, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#5A6478' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1B3A6B' }} />
      {label}
    </label>
  );
}

// ── component ───────────────────────────────────────────────────────────────

export default function NuevoClientePage() {
  const navigate = useNavigate();

  // Datos de la persona (van a POST /clientes)
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [cuil, setCuil] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [domicilioCp, setDomicilioCp] = useState('');
  const [domicilioLocalidad, setDomicilioLocalidad] = useState('');
  const [domicilioProvincia, setDomicilioProvincia] = useState('');
  const [domicilioCoincide, setDomicilioCoincide] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const col2Grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
  const fieldGap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };

  /**
   * Guarda el cliente. Si `crearCaso` es true, redirige a la creación de caso
   * con el cliente recién creado ya preseleccionado; si no, vuelve al listado.
   */
  async function handleGuardar(crearCaso: boolean) {
    const nombreCompleto = [apellido.trim(), nombre.trim()].filter(Boolean).join(', ');
    if (!nombreCompleto) { setError('El nombre y apellido son obligatorios.'); return; }
    if (!dni.trim()) { setError('El DNI es obligatorio.'); return; }

    const datos: ClienteCreate = {
      nombre: nombreCompleto,
      dni: dni.trim(),
      cuil: cuil.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      domicilio_real: domicilio.trim() || null,
      domicilio_real_cp: domicilioCp.trim() || null,
      domicilio_real_localidad: domicilioLocalidad.trim() || null,
      domicilio_real_provincia: domicilioProvincia.trim() || null,
      domicilio_coincide_dni: domicilioCoincide,
    };

    setSaving(true);
    setError(null);
    try {
      const nuevo = await api.crear(datos);
      if (crearCaso) {
        navigate('/casos/nuevo', { state: { cliente: nuevo } });
      } else {
        navigate('/clientes');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409')) {
        setError('El DNI ingresado ya está registrado para otro cliente en el estudio.');
      } else if (msg.includes('422')) {
        setError('Datos inválidos. Verificá el formato del email y que nombre y DNI estén completos.');
      } else {
        setError('Error al guardar el cliente. Intentá de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#F2F0EA', minHeight: '100vh', padding: '32px 32px 48px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0 }}>
          Admisión de cliente
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#7B8799', marginTop: 6, marginBottom: 0 }}>
          Completá los datos de la persona para registrar un nuevo cliente
        </p>
      </div>

      {/* Error global */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 16px', marginTop: 16, fontSize: 13, color: '#991B1B', fontFamily: "'Inter', sans-serif" }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 24, alignItems: 'start' }}>

        {/* Left column */}
        <div>

          {/* Section 1 — Datos de la persona */}
          <SectionCard>
            <SectionHeader num={1} title="Datos de la persona" />
            <div style={fieldGap}>
              <div style={col2Grid}>
                <Field label="Nombre *">
                  <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Carlos" />
                </Field>
                <Field label="Apellido *">
                  <input style={inputStyle} value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Ej: González" />
                </Field>
              </div>
              <div style={col2Grid}>
                <Field label="DNI *">
                  <input style={inputStyle} value={dni} onChange={e => setDni(e.target.value)} placeholder="Ej: 28456123" />
                </Field>
                <Field label="CUIL">
                  <input style={inputStyle} value={cuil} onChange={e => setCuil(e.target.value)} placeholder="Ej: 20-28456123-4" />
                </Field>
              </div>
              <Field label="Domicilio real">
                <input style={inputStyle} value={domicilio} onChange={e => setDomicilio(e.target.value)} placeholder="Calle, número, piso/depto" />
              </Field>
              <div style={col2Grid}>
                <Field label="Código postal">
                  <input style={inputStyle} value={domicilioCp} onChange={e => setDomicilioCp(e.target.value)} placeholder="5500" />
                </Field>
                <Field label="Localidad">
                  <input style={inputStyle} value={domicilioLocalidad} onChange={e => setDomicilioLocalidad(e.target.value)} placeholder="Mendoza" />
                </Field>
              </div>
              <Field label="Provincia">
                <input style={inputStyle} value={domicilioProvincia} onChange={e => setDomicilioProvincia(e.target.value)} placeholder="Mendoza" />
              </Field>
              <CheckField
                label="El domicilio real coincide con el del DNI"
                checked={domicilioCoincide}
                onChange={() => setDomicilioCoincide(v => !v)}
              />
              <div style={col2Grid}>
                <Field label="Teléfono">
                  <input style={inputStyle} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 261 4567890" />
                </Field>
                <Field label="Email">
                  <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Nota: datos del trabajo se registrarán al crear el caso (RF-08/RF-09) */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#92400E', fontFamily: "'Inter', sans-serif" }}>
            Los datos del trabajo y la situación registral se completan al crear el caso laboral (siguiente paso).
          </div>

        </div>

        {/* Right column — sticky save card */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 15, color: '#131C2E' }}>
              Guardar cliente
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#7B8799', marginTop: 6, marginBottom: 0 }}>
              Los datos se guardarán de forma segura conforme a la Ley 25.326.
            </p>
            <button
              onClick={() => void handleGuardar(false)}
              disabled={saving}
              style={{
                width: '100%', height: 44, background: saving ? '#7B8799' : '#1B3A6B', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif", marginTop: 16,
              }}
            >
              {saving ? 'Guardando…' : 'Guardar cliente'}
            </button>
            <button
              onClick={() => void handleGuardar(true)}
              disabled={saving}
              style={{
                width: '100%', height: 44, background: '#FFFFFF', color: '#1B3A6B',
                border: '1.5px solid #1B3A6B', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif", marginTop: 8,
              }}
            >
              Guardar cliente y crear caso
            </button>
            <button
              onClick={() => navigate('/clientes')}
              disabled={saving}
              style={{
                width: '100%', background: '#F2F0EA', color: '#5A6478',
                border: '1px solid #D8D4CA', borderRadius: 8, padding: '9px 16px',
                fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif", marginTop: 8,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
