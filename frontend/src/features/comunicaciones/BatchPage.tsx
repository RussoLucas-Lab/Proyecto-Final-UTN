import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── helpers ────────────────────────────────────────────────────────────────

const badge = (bg: string, color: string, text: string) => (
  <span style={{ background: bg, color, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' as const }}>{text}</span>
);

// ── mock data ───────────────────────────────────────────────────────────────

interface BatchItem {
  id: number;
  initials: string;
  bg: string;
  color: string;
  nombre: string;
  etapa: string;
  etapaBg: string;
  etapaColor: string;
  aprobado: boolean;
}

const ITEMS: BatchItem[] = [
  { id: 1, initials: 'GP', bg: '#E8EDF8', color: '#1B3A6B', nombre: 'González Pérez, Carlos', etapa: 'Telegrama 1', etapaBg: '#E8EDF8', etapaColor: '#1B3A6B', aprobado: false },
  { id: 2, initials: 'MR', bg: '#E3F5F5', color: '#0B7285', nombre: 'Martínez Rojas, Ana', etapa: 'Denuncia ART', etapaBg: '#E3F5F5', etapaColor: '#0B7285', aprobado: false },
  { id: 3, initials: 'DF', bg: '#E8EDF8', color: '#1B3A6B', nombre: 'Díaz Fuentes, Roberto', etapa: 'Conciliación', etapaBg: '#FEF3E2', etapaColor: '#B45309', aprobado: true },
];

const DEFAULT_DRAFT = 'Estimado Sr. González, le informamos que su caso ha avanzado satisfactoriamente a la etapa de Telegrama Obrero. En los próximos días nos estaremos comunicando para coordinar los pasos a seguir. Quedamos a su disposición.';

// ── component ───────────────────────────────────────────────────────────────

export default function BatchPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(1);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [approvedIds, setApprovedIds] = useState<Set<number>>(new Set([3]));

  const selected = ITEMS.find(i => i.id === selectedId)!;
  const currentIdx = ITEMS.findIndex(i => i.id === selectedId);
  const approvedCount = approvedIds.size;

  function handleApprove() {
    setApprovedIds(prev => new Set([...prev, selectedId]));
  }

  function handleDiscard() {
    setApprovedIds(prev => {
      const next = new Set(prev);
      next.delete(selectedId);
      return next;
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(draft).catch(() => {});
  }

  function goNext() {
    if (currentIdx < ITEMS.length - 1) {
      setSelectedId(ITEMS[currentIdx + 1].id);
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      setSelectedId(ITEMS[currentIdx - 1].id);
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#F2F0EA', minHeight: '100vh', padding: '32px 32px 48px', boxSizing: 'border-box' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0 }}>
            Revisión de actualizaciones
          </h1>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#7B8799' }}>
            {approvedCount} de {ITEMS.length} revisados
          </span>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: '#F2F0EA', color: '#5A6478', border: '1px solid #D8D4CA', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          Cerrar
        </button>
      </div>

      {/* Two-column panel */}
      <div style={{ display: 'flex', marginTop: 24, borderRadius: 12, overflow: 'hidden' }}>

        {/* Left panel */}
        <div style={{ width: 280, background: '#FFFFFF', border: '1px solid #E5E2D8', borderRight: 'none', borderRadius: '12px 0 0 12px', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13, color: '#131C2E',
            padding: '14px 16px', borderBottom: '1px solid #E9E6DE',
          }}>
            Pendientes
          </div>
          {ITEMS.map(item => {
            const isSelected = item.id === selectedId;
            const isApproved = approvedIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #F2F0EA',
                  cursor: 'pointer',
                  background: isSelected ? '#F2F0EA' : '#FFFFFF',
                  borderLeft: isSelected ? '3px solid #1B3A6B' : '3px solid transparent',
                  transition: 'background 0.1s',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: item.bg, color: item.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, fontFamily: "'Inter', sans-serif", flexShrink: 0,
                  }}>
                    {item.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: '#131C2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.nombre}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {badge(item.etapaBg, item.etapaColor, item.etapa)}
                    </div>
                  </div>
                  {isApproved && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A7A4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E5E2D8', borderLeft: 'none', borderRadius: '0 12px 12px 0', padding: 24 }}>

          {/* Client header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 8,
              background: selected.bg, color: selected.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, fontFamily: "'Inter', sans-serif", flexShrink: 0,
            }}>
              {selected.initials}
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: '#131C2E' }}>
                {selected.nombre}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {badge('#E8EDF8', '#1B3A6B', 'Laboral')}
                {badge(selected.etapaBg, selected.etapaColor, selected.etapa)}
              </div>
            </div>
          </div>

          {/* AI notice */}
          <div style={{
            marginTop: 16, background: '#FFF9EC', border: '1px solid #F5D99A',
            borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C9A028" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#B45309', lineHeight: 1.5 }}>
              La IA genera un borrador. El abogado revisa y aprueba antes de enviar por WhatsApp. Nada se envía automáticamente.
            </span>
          </div>

          {/* Draft textarea */}
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              marginTop: 16, width: '100%', minHeight: 180, border: '1.5px solid #E5E2D8',
              borderRadius: 8, background: '#FAFAF7', padding: 14, fontSize: 13,
              fontFamily: "'Inter', sans-serif", color: '#131C2E',
              boxSizing: 'border-box', resize: 'vertical', outline: 'none', lineHeight: 1.6,
            }}
          />

          {/* Action bar */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleApprove}
                style={{
                  background: '#1A7A4A', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}
              >
                Aprobar
              </button>
              <button
                onClick={handleCopy}
                style={{
                  background: '#F2F0EA', color: '#5A6478', border: '1px solid #D8D4CA',
                  borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}
              >
                Copiar
              </button>
            </div>
            <button
              onClick={handleDiscard}
              style={{
                background: '#FEE4E2', color: '#C9423A', border: '1px solid #F5C2C0',
                borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              }}
            >
              Descartar
            </button>
          </div>

          {/* Navigation row */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              style={{
                background: '#F2F0EA', color: currentIdx === 0 ? '#B0AFA8' : '#5A6478',
                border: '1px solid #D8D4CA', borderRadius: 8, padding: '7px 14px',
                fontSize: 12, fontWeight: 600, cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              ← Anterior
            </button>
            <button
              onClick={goNext}
              disabled={currentIdx === ITEMS.length - 1}
              style={{
                background: '#F2F0EA', color: currentIdx === ITEMS.length - 1 ? '#B0AFA8' : '#5A6478',
                border: '1px solid #D8D4CA', borderRadius: 8, padding: '7px 14px',
                fontSize: 12, fontWeight: 600, cursor: currentIdx === ITEMS.length - 1 ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Siguiente →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
