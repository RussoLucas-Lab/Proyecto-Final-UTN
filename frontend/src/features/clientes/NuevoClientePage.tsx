import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #E5E2D8',
  borderRadius: 7,
  background: '#FAFAF7',
  padding: '10px 12px',
  fontSize: 13,
  color: '#131C2E',
  fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
  resize: 'vertical',
  outline: 'none',
};

// ── sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: '#1B3A6B',
        color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'Inter', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
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
    <div style={{
      background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12,
      padding: 22, marginBottom: 16,
    }}>
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

  // Section 1 — Datos de la persona
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [cuil, setCuil] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [domicilioCoincide, setDomicilioCoincide] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  // Section 2 — Datos del trabajo
  const [razonSocial, setRazonSocial] = useState('');
  const [direccionTrabajo, setDireccionTrabajo] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [motivoCese, setMotivoCese] = useState('');
  const [jornada, setJornada] = useState('');
  const [tareas, setTareas] = useState('');
  const [remuneracion, setRemuneracion] = useState('');
  const [cct, setCct] = useState('');

  // Section 3 — Situación registral
  const [estadoAportes, setEstadoAportes] = useState('');
  const [fechaAfip, setFechaAfip] = useState('');
  const [sueldoNoCoincide, setSueldoNoCoincide] = useState(false);
  const [jornadaNoCoincide, setJornadaNoCoincide] = useState(false);

  // Section 4 — Notas
  const [notas, setNotas] = useState('');

  const col2Grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
  const fieldGap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#F2F0EA', minHeight: '100vh', padding: '32px 32px 48px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0 }}>
          Admisión de cliente
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#7B8799', marginTop: 6, marginBottom: 0 }}>
          Completá el formulario para registrar un nuevo cliente
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 24, alignItems: 'start' }}>

        {/* Left column */}
        <div>

          {/* Section 1 */}
          <SectionCard>
            <SectionHeader num={1} title="Datos de la persona" />
            <div style={fieldGap}>
              <div style={col2Grid}>
                <Field label="Nombre">
                  <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Carlos" />
                </Field>
                <Field label="Apellido">
                  <input style={inputStyle} value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Ej: González" />
                </Field>
              </div>
              <div style={col2Grid}>
                <Field label="DNI">
                  <input style={inputStyle} value={dni} onChange={e => setDni(e.target.value)} placeholder="Ej: 28.456.123" />
                </Field>
                <Field label="CUIL">
                  <input style={inputStyle} value={cuil} onChange={e => setCuil(e.target.value)} placeholder="Ej: 20-28456123-4" />
                </Field>
              </div>
              <Field label="Domicilio real">
                <input style={inputStyle} value={domicilio} onChange={e => setDomicilio(e.target.value)} placeholder="Calle, número, piso/depto, ciudad" />
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

          {/* Section 2 */}
          <SectionCard>
            <SectionHeader num={2} title="Datos del trabajo" />
            <div style={fieldGap}>
              <Field label="Razón social del empleador">
                <input style={inputStyle} value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Nombre legal de la empresa" />
              </Field>
              <Field label="Dirección del trabajo">
                <input style={inputStyle} value={direccionTrabajo} onChange={e => setDireccionTrabajo(e.target.value)} placeholder="Domicilio laboral" />
              </Field>
              <div style={col2Grid}>
                <Field label="Fecha de inicio">
                  <input style={inputStyle} type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
                </Field>
                <Field label="Motivo de cese">
                  <input style={inputStyle} value={motivoCese} onChange={e => setMotivoCese(e.target.value)} placeholder="Ej: Despido sin causa" />
                </Field>
              </div>
              <Field label="Jornada laboral">
                <select style={selectStyle} value={jornada} onChange={e => setJornada(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  <option value="completa">Completa</option>
                  <option value="parcial">Parcial</option>
                  <option value="variable">Variable</option>
                </select>
              </Field>
              <Field label="Tareas habituales">
                <textarea style={textareaStyle} rows={3} value={tareas} onChange={e => setTareas(e.target.value)} placeholder="Describí las tareas que realizaba habitualmente" />
              </Field>
              <div style={col2Grid}>
                <Field label="Remuneración bruta mensual">
                  <input style={inputStyle} value={remuneracion} onChange={e => setRemuneracion(e.target.value)} placeholder="Ej: $850.000" />
                </Field>
                <Field label="CCT / Convenio colectivo">
                  <input style={inputStyle} value={cct} onChange={e => setCct(e.target.value)} placeholder="Ej: CCT 260/75" />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Section 3 */}
          <SectionCard>
            <SectionHeader num={3} title="Situación registral" />
            <div style={fieldGap}>
              <Field label="Estado de aportes">
                <select style={selectStyle} value={estadoAportes} onChange={e => setEstadoAportes(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  <option value="al_dia">Al día</option>
                  <option value="irregulares">Irregulares</option>
                  <option value="sin_registracion">Sin registración</option>
                </select>
              </Field>
              <Field label="Fecha de alta AFIP">
                <input style={inputStyle} type="date" value={fechaAfip} onChange={e => setFechaAfip(e.target.value)} />
              </Field>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <CheckField
                  label="El sueldo no coincide con el recibo de sueldo"
                  checked={sueldoNoCoincide}
                  onChange={() => setSueldoNoCoincide(v => !v)}
                />
                <CheckField
                  label="La jornada no coincide con lo registrado"
                  checked={jornadaNoCoincide}
                  onChange={() => setJornadaNoCoincide(v => !v)}
                />
              </div>
            </div>
          </SectionCard>

          {/* Section 4 */}
          <SectionCard>
            <SectionHeader num={4} title="Notas internas" />
            <textarea
              style={{ ...textareaStyle, minHeight: 100 }}
              rows={5}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones relevantes para el caso..."
            />
          </SectionCard>

        </div>

        {/* Right column — sticky save card */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 15, color: '#131C2E' }}>
              Guardar cliente
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#7B8799', marginTop: 6, marginBottom: 0 }}>
              Los datos se guardarán de forma segura.
            </p>
            <button
              style={{
                width: '100%', height: 44, background: '#1B3A6B', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: 16,
              }}
            >
              Guardar cliente
            </button>
            <button
              onClick={() => navigate('/clientes')}
              style={{
                width: '100%', background: '#F2F0EA', color: '#5A6478',
                border: '1px solid #D8D4CA', borderRadius: 8, padding: '9px 16px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
