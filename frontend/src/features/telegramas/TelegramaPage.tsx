import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ── style helpers ───────────────────────────────────────────────────────────

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, padding: 22, marginBottom: 16 }}>
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
      {children}
    </div>
  );
}

// ── today helper ────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date(2026, 5, 24).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── component ───────────────────────────────────────────────────────────────

export default function TelegramaPage() {
  const navigate = useNavigate();
  const { casoId } = useParams<{ casoId: string }>();

  // Destinatario
  const [razonSocial, setRazonSocial] = useState('Metalúrgica del Oeste S.A.');
  const [ramo, setRamo] = useState('Metalurgia y manufactura');
  const [domicilioLaboral, setDomicilioLaboral] = useState('Av. San Martín 1450');
  const [cpDest, setCpDest] = useState('5500');
  const [localidadDest, setLocalidadDest] = useState('Mendoza');
  const [provinciaDest, setProvinciaDest] = useState('Mendoza');

  // Remitente
  const [nombreRemitente, setNombreRemitente] = useState('González Pérez, Carlos');
  const [dniRemitente, setDniRemitente] = useState('28.456.123');
  const [fechaTelegrama] = useState(todayStr());
  const [domicilioRemitente, setDomicilioRemitente] = useState('Lavalle 892, piso 3');
  const [cpRemit, setCpRemit] = useState('5500');
  const [localidadRemit, setLocalidadRemit] = useState('Mendoza');
  const [provinciaRemit, setProvinciaRemit] = useState('Mendoza');

  // Texto
  const [texto, setTexto] = useState('');
  const MAX_CHARS = 500;

  const col2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
  const col3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 14 };
  const fieldGap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };

  // Preview lines
  const previewLines = [
    `SR/A:              ${razonSocial}`,
    `ACTIVIDAD:         ${ramo}`,
    `DOMICILIO:         ${domicilioLaboral}, CP ${cpDest}, ${localidadDest}, ${provinciaDest}`,
  ];
  const remitLines = [
    `APELLIDO Y NOMBRE: ${nombreRemitente}`,
    `N° DNI:            ${dniRemitente}`,
    `DOMICILIO:         ${domicilioRemitente}, CP ${cpRemit}, ${localidadRemit}, ${provinciaRemit}`,
    `FECHA:             ${fechaTelegrama}`,
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#F2F0EA', minHeight: '100vh', padding: '32px 32px 48px', boxSizing: 'border-box' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, color: '#7B8799', fontFamily: "'Inter', sans-serif" }}>
        <button
          onClick={() => navigate(`/casos/${casoId ?? '1'}/laboral`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7B8799', fontFamily: "'Inter', sans-serif", fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Casos
        </button>
        <span style={{ color: '#B0AFA8' }}>/</span>
        <span style={{ color: '#5A6478' }}>EXP-2026-000042</span>
        <span style={{ color: '#B0AFA8' }}>/</span>
        <span style={{ color: '#131C2E', fontWeight: 600 }}>Telegrama</span>
      </div>

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0 }}>
          Generador de telegrama
        </h1>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#7B8799' }}>Ley 23.789</span>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24, alignItems: 'start' }}>

        {/* Left column */}
        <div>

          {/* Card 1 — Destinatario */}
          <SectionCard num={1} title="Destinatario (empleador)">
            <div style={fieldGap}>
              <Field label="Razón social">
                <input style={inputStyle} value={razonSocial} onChange={e => setRazonSocial(e.target.value)} />
              </Field>
              <Field label="Ramo o actividad">
                <input style={inputStyle} value={ramo} onChange={e => setRamo(e.target.value)} />
              </Field>
              <Field label="Domicilio laboral">
                <input style={inputStyle} value={domicilioLaboral} onChange={e => setDomicilioLaboral(e.target.value)} />
              </Field>
              <div style={col3}>
                <Field label="CP">
                  <input style={inputStyle} value={cpDest} onChange={e => setCpDest(e.target.value)} />
                </Field>
                <Field label="Localidad">
                  <input style={inputStyle} value={localidadDest} onChange={e => setLocalidadDest(e.target.value)} />
                </Field>
                <Field label="Provincia">
                  <input style={inputStyle} value={provinciaDest} onChange={e => setProvinciaDest(e.target.value)} />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Card 2 — Remitente */}
          <SectionCard num={2} title="Remitente (trabajador)">
            <div style={fieldGap}>
              <div style={col2}>
                <Field label="Apellido y nombre">
                  <input style={inputStyle} value={nombreRemitente} onChange={e => setNombreRemitente(e.target.value)} />
                </Field>
                <Field label="N° DNI">
                  <input style={inputStyle} value={dniRemitente} onChange={e => setDniRemitente(e.target.value)} />
                </Field>
              </div>
              <div style={col2}>
                <Field label="Fecha">
                  <input style={inputStyle} value={fechaTelegrama} readOnly />
                </Field>
                <Field label="Domicilio real">
                  <input style={inputStyle} value={domicilioRemitente} onChange={e => setDomicilioRemitente(e.target.value)} />
                </Field>
              </div>
              <div style={col3}>
                <Field label="CP">
                  <input style={inputStyle} value={cpRemit} onChange={e => setCpRemit(e.target.value)} />
                </Field>
                <Field label="Localidad">
                  <input style={inputStyle} value={localidadRemit} onChange={e => setLocalidadRemit(e.target.value)} />
                </Field>
                <Field label="Provincia">
                  <input style={inputStyle} value={provinciaRemit} onChange={e => setProvinciaRemit(e.target.value)} />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Card 3 — Texto */}
          <SectionCard num={3} title="Texto del telegrama">
            <textarea
              value={texto}
              onChange={e => { if (e.target.value.length <= MAX_CHARS) setTexto(e.target.value); }}
              placeholder="Ingresá el texto del telegrama..."
              style={{
                width: '100%', minHeight: 140, border: '1.5px solid #E5E2D8',
                borderRadius: 7, background: '#FAFAF7', padding: '10px 12px',
                fontSize: 13, color: '#131C2E', fontFamily: "'Inter', sans-serif",
                boxSizing: 'border-box', resize: 'vertical', outline: 'none', lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#7B8799' }}>
                El telegrama obrero gratuito tiene límite de 20 palabras por línea según Ley 23.789.
              </span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: texto.length > MAX_CHARS * 0.9 ? '#C9423A' : '#7B8799' }}>
                {texto.length} / {MAX_CHARS} caracteres
              </span>
            </div>
            <button
              style={{
                width: '100%', height: 44, background: '#C9A028', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: 16,
              }}
            >
              Generar PDF
            </button>
          </SectionCard>

        </div>

        {/* Right column — sticky preview */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E9E6DE' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 14, color: '#131C2E' }}>
                Previsualización
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#7B8799', marginTop: 2 }}>
                Se actualiza en tiempo real
              </div>
            </div>
            <div style={{ padding: '20px 24px', overflowX: 'auto' }}>
              <pre style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 11, color: '#131C2E', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {`TELEGRAMA OBRERO GRATUITO — Ley 23.789\n`}
                {`Fecha: ${fechaTelegrama}\n`}
              </pre>

              {/* Destinatario box */}
              <div style={{ border: '1px solid #131C2E', padding: 10, marginTop: 8 }}>
                <pre style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 11, color: '#131C2E', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {previewLines.join('\n')}
                </pre>
              </div>

              {/* Remitente box */}
              <div style={{ border: '1px solid #131C2E', padding: 10, marginTop: 8 }}>
                <pre style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 11, color: '#131C2E', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {remitLines.join('\n')}
                </pre>
              </div>

              {/* Texto box */}
              <div style={{ border: '1px solid #131C2E', padding: 10, marginTop: 8, minHeight: 60 }}>
                <pre style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 11, color: texto ? '#131C2E' : '#B0AFA8', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {texto || '(texto del telegrama)'}
                </pre>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
