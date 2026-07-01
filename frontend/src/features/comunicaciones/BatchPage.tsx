import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarPendientes, revisarComunicacion } from './api';
import type { BorradorPendiente } from './types';

// ── helpers ────────────────────────────────────────────────────────────────

const badge = (bg: string, color: string, text: string) => (
  <span style={{ background: bg, color, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' as const }}>{text}</span>
);

// Colores por área: LABORAL/ART son los únicos dos valores del enum AreaDerecho
// (mismo esquema que CasosPage.tsx). La etapa reutiliza el color del área — los
// NOMBRES de etapa vienen del backend y nunca se hardcodean (frontend/CLAUDE.md).
const AREA_BADGE: Record<string, { bg: string; color: string }> = {
  LABORAL: { bg: '#E8EDF8', color: '#1B3A6B' },
  ART: { bg: '#E3F5F5', color: '#0B7285' },
};
const AREA_LABEL: Record<string, string> = {
  LABORAL: 'Laboral',
  ART: 'ART',
};

function initialsOf(nombre: string): string {
  const partes = nombre.trim().split(/[\s,]+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

// ── component ───────────────────────────────────────────────────────────────

export default function BatchPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<BorradorPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listarPendientes('PENDIENTE_REVISION');
      setItems(data);
      setSelectedId(data.length > 0 ? data[0].id : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const currentIdx = items.findIndex((i) => i.id === selectedId);
  const revisadosCount = items.filter((i) => i.estado !== 'PENDIENTE_REVISION').length;

  useEffect(() => {
    setDraft(selected?.preview ?? '');
    setCopied(false);
  }, [selected?.id, selected?.preview]);

  async function handleRevisar(estado: 'APROBADO' | 'DESCARTADO') {
    if (selected === null) return;
    setActionError(null);
    try {
      await revisarComunicacion(selected.id, estado);
      setItems((prev) => prev.map((i) => (i.id === selected.id ? { ...i, estado } : i)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCopy() {
    if (!draft) return;
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function goNext() {
    if (currentIdx >= 0 && currentIdx < items.length - 1) {
      setSelectedId(items[currentIdx + 1].id);
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      setSelectedId(items[currentIdx - 1].id);
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
          {!loading && !error && (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#7B8799' }}>
              {revisadosCount} de {items.length} revisados
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: '#F2F0EA', color: '#5A6478', border: '1px solid #D8D4CA', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          Cerrar
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ marginTop: 24, background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, padding: 32, textAlign: 'center', color: '#7B8799', fontSize: 13 }}>
          Cargando borradores pendientes…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{ marginTop: 24, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#991B1B' }}>No se pudieron cargar los borradores: {error}</p>
          <button
            onClick={cargar}
            style={{ marginTop: 10, background: '#991B1B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div style={{ marginTop: 24, background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, padding: 32, textAlign: 'center', color: '#7B8799', fontSize: 13 }}>
          No hay borradores pendientes de revisión por ahora.
        </div>
      )}

      {/* Two-column panel */}
      {!loading && !error && items.length > 0 && selected && (
        <div style={{ display: 'flex', marginTop: 24, borderRadius: 12, overflow: 'hidden' }}>

          {/* Left panel */}
          <div style={{ width: 280, background: '#FFFFFF', border: '1px solid #E5E2D8', borderRight: 'none', borderRadius: '12px 0 0 12px', flexShrink: 0, overflow: 'hidden' }}>
            <div style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13, color: '#131C2E',
              padding: '14px 16px', borderBottom: '1px solid #E9E6DE',
            }}>
              Pendientes
            </div>
            {items.map(item => {
              const isSelected = item.id === selectedId;
              const isApproved = item.estado === 'APROBADO';
              const isDiscarded = item.estado === 'DESCARTADO';
              const areaBadge = AREA_BADGE[item.area] ?? { bg: '#EEECE4', color: '#5A6478' };
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
                    opacity: isDiscarded ? 0.55 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: areaBadge.bg, color: areaBadge.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 11, fontFamily: "'Inter', sans-serif", flexShrink: 0,
                    }}>
                      {initialsOf(item.cliente)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: '#131C2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.cliente}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {badge(areaBadge.bg, areaBadge.color, item.etapa)}
                      </div>
                    </div>
                    {isApproved && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A7A4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {isDiscarded && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9423A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
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
                background: (AREA_BADGE[selected.area] ?? { bg: '#EEECE4', color: '#5A6478' }).bg,
                color: (AREA_BADGE[selected.area] ?? { bg: '#EEECE4', color: '#5A6478' }).color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13, fontFamily: "'Inter', sans-serif", flexShrink: 0,
              }}>
                {initialsOf(selected.cliente)}
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: '#131C2E' }}>
                  {selected.cliente}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {badge('#E8EDF8', '#1B3A6B', AREA_LABEL[selected.area] ?? selected.area)}
                  {badge((AREA_BADGE[selected.area] ?? { bg: '#EEECE4', color: '#5A6478' }).bg, (AREA_BADGE[selected.area] ?? { bg: '#EEECE4', color: '#5A6478' }).color, selected.etapa)}
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

            {actionError && (
              <div style={{ marginTop: 12, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#991B1B' }}>
                {actionError}
              </div>
            )}

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
                  onClick={() => handleRevisar('APROBADO')}
                  disabled={selected.estado !== 'PENDIENTE_REVISION'}
                  style={{
                    background: selected.estado !== 'PENDIENTE_REVISION' ? '#B7D8C4' : '#1A7A4A', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
                    cursor: selected.estado !== 'PENDIENTE_REVISION' ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
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
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
              <button
                onClick={() => handleRevisar('DESCARTADO')}
                disabled={selected.estado !== 'PENDIENTE_REVISION'}
                style={{
                  background: '#FEE4E2', color: '#C9423A', border: '1px solid #F5C2C0',
                  borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
                  cursor: selected.estado !== 'PENDIENTE_REVISION' ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
                  opacity: selected.estado !== 'PENDIENTE_REVISION' ? 0.6 : 1,
                }}
              >
                Descartar
              </button>
            </div>

            {/* Navigation row */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button
                onClick={goPrev}
                disabled={currentIdx <= 0}
                style={{
                  background: '#F2F0EA', color: currentIdx <= 0 ? '#B0AFA8' : '#5A6478',
                  border: '1px solid #D8D4CA', borderRadius: 8, padding: '7px 14px',
                  fontSize: 12, fontWeight: 600, cursor: currentIdx <= 0 ? 'not-allowed' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                ← Anterior
              </button>
              <button
                onClick={goNext}
                disabled={currentIdx === items.length - 1}
                style={{
                  background: '#F2F0EA', color: currentIdx === items.length - 1 ? '#B0AFA8' : '#5A6478',
                  border: '1px solid #D8D4CA', borderRadius: 8, padding: '7px 14px',
                  fontSize: 12, fontWeight: 600, cursor: currentIdx === items.length - 1 ? 'not-allowed' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Siguiente →
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
