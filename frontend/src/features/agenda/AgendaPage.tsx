import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── helpers ────────────────────────────────────────────────────────────────

const badge = (bg: string, color: string, text: string) => (
  <span style={{ background: bg, color, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' as const }}>{text}</span>
);

// ── calendar logic for June 2026 ────────────────────────────────────────────
// June 2026: 30 days, starts on Monday (day index 0 in Mon-Sun week)
// Actually: June 1 2026 is a Monday

function getJune2026Days() {
  // June 2026 — 30 days, starts Monday
  // We display a Mon-Sun grid
  const days: Array<{ day: number | null; isToday: boolean; events: string[] }> = [];

  // June 1 2026 = Monday (index 0 in Mon-Sun)
  // No leading empty cells needed since June 1 is Monday
  for (let d = 1; d <= 30; d++) {
    const isToday = d === 24;
    const events: string[] = [];
    if (d === 24) events.push('Conciliación SECLO');
    if (d === 26) events.push('Telegrama vence');
    if (d === 28) events.push('Audiencia');
    days.push({ day: d, isToday, events });
  }

  // We need to pad to fill a 6-row grid (42 cells). 30 days + 0 leading = 30 cells total
  // Fill trailing empty cells to complete the last week row
  // 30 cells — last day is a Tuesday (day 1 in 0-indexed Mon-Sun) so trailing = 5
  const trailing = 42 - 30;
  for (let i = 0; i < trailing; i++) {
    days.push({ day: null, isToday: false, events: [] });
  }

  return days;
}

const DAYS_HEADER = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

// ── event styling ───────────────────────────────────────────────────────────

function eventPill(text: string, key: number) {
  const isArt = text.includes('ART') || text.includes('vence');
  const bg = isArt ? '#E3F5F5' : '#E8EDF8';
  const color = isArt ? '#0B7285' : '#1B3A6B';
  return (
    <div key={key} style={{
      background: bg, color, borderRadius: 8, fontSize: 10, fontWeight: 600,
      fontFamily: "'Inter', sans-serif", padding: '1px 4px', marginTop: 2,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {text}
    </div>
  );
}

// ── upcoming events data ────────────────────────────────────────────────────

interface Evento {
  dateLabel: string;
  nombre: string;
  area: 'Laboral' | 'ART';
  desc: string;
  isToday: boolean;
}

const EVENTOS: Evento[] = [
  { dateLabel: 'Hoy', nombre: 'Conciliación SECLO - González Pérez', area: 'Laboral', desc: 'SECLO Mendoza, 10:00hs', isToday: true },
  { dateLabel: '26 Jun', nombre: 'Telegrama 2 vence', area: 'ART', desc: 'Plazo legal 20 días', isToday: false },
  { dateLabel: '28 Jun', nombre: 'Audiencia - Juzgado 4 Laboral', area: 'Laboral', desc: 'Mendoza, 9:00hs', isToday: false },
  { dateLabel: '3 Jul', nombre: 'Comisión médica - Martínez', area: 'ART', desc: 'SRT Mendoza', isToday: false },
];

// ── component ───────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<'mensual' | 'semanal'>('mensual');

  const calDays = getJune2026Days();

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#F2F0EA', minHeight: '100vh', padding: '32px 32px 48px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0 }}>
          Agenda
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Segmented toggle */}
          <div style={{ display: 'flex', background: '#E5E2D8', borderRadius: 8, padding: 2 }}>
            {(['mensual', 'semanal'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  background: view === v ? '#FFFFFF' : 'transparent',
                  color: view === v ? '#131C2E' : '#7B8799',
                  border: 'none', borderRadius: 6, padding: '6px 14px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => {}}
            style={{
              background: '#F2F0EA', color: '#5A6478', border: '1px solid #D8D4CA',
              borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}
          >
            + Nuevo movimiento
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 24, alignItems: 'start' }}>

        {/* Left — Calendar card */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, padding: 22 }}>

          {/* Month header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#5A6478', padding: '4px 8px' }}>←</button>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: '#131C2E' }}>
              Junio 2026
            </span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#5A6478', padding: '4px 8px' }}>→</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 4 }}>
            {DAYS_HEADER.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontFamily: "'Inter', sans-serif",
                fontWeight: 600, fontSize: 11, color: '#7B8799',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                padding: '6px 0',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
            {calDays.map((cell, idx) => {
              const isWeekend = idx % 7 === 5 || idx % 7 === 6;
              return (
                <div
                  key={idx}
                  style={{
                    minHeight: 68,
                    background: cell.day === null ? '#FAFAF7' : '#FFFFFF',
                    borderTop: '1px solid #F2F0EA',
                    borderLeft: '1px solid #F2F0EA',
                    padding: '6px 6px 4px',
                    boxSizing: 'border-box',
                  }}
                >
                  {cell.day !== null && (
                    <>
                      {/* Day number */}
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
                        {cell.isToday ? (
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#1B3A6B', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13,
                          }}>
                            {cell.day}
                          </div>
                        ) : (
                          <span style={{
                            fontFamily: "'Inter', sans-serif", fontSize: 13,
                            color: isWeekend ? '#B0AFA8' : '#131C2E',
                            fontWeight: 400,
                          }}>
                            {cell.day}
                          </span>
                        )}
                      </div>
                      {/* Event pills */}
                      {cell.events.map((ev, ei) => eventPill(ev, ei))}
                    </>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Right — Próximos movimientos */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E2D8', borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 15, color: '#131C2E' }}>
            Próximos movimientos
          </div>

          {/* Amber disclaimer */}
          <div style={{
            marginTop: 12, background: '#FFF9EC', border: '1px solid #F5D99A',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#B45309', lineHeight: 1.5 }}>
              Los vencimientos son orientativos. Los plazos judiciales dependen de días hábiles y calendarios del fuero.
            </span>
          </div>

          {/* Events list */}
          <div style={{ marginTop: 16 }}>
            {EVENTOS.map((ev, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 12,
                  padding: '12px 0',
                  borderBottom: i < EVENTOS.length - 1 ? '1px solid #F2F0EA' : 'none',
                }}
              >
                {/* Left colored border indicator */}
                <div style={{
                  width: 4, borderRadius: 2, flexShrink: 0,
                  background: ev.isToday ? '#C9A028' : '#D8D4CA',
                  alignSelf: 'stretch',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 11,
                    color: ev.isToday ? '#C9A028' : '#7B8799',
                    textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3,
                  }}>
                    {ev.dateLabel}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: '#131C2E', marginBottom: 4 }}>
                    {ev.nombre}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {ev.area === 'Laboral'
                      ? badge('#E8EDF8', '#1B3A6B', 'Laboral')
                      : badge('#E3F5F5', '#0B7285', 'ART')
                    }
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#7B8799' }}>
                      {ev.desc}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
