import React, { useEffect, useState } from 'react';
import { listarVencimientosRango } from './api';
import { CalendarioMes } from './components/CalendarioMes';
import type { VencimientoAgendaItem } from './types';

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function primerDiaMes(año: number, mes: number): string {
  return `${año}-${String(mes + 1).padStart(2, '0')}-01`;
}

function ultimoDiaMes(año: number, mes: number): string {
  const ultimo = new Date(año, mes + 1, 0).getDate();
  return `${año}-${String(mes + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

function isoFecha(año: number, mes: number, dia: number): string {
  return `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function areaBadgeStyle(area: string): React.CSSProperties {
  const isArt = area === 'ART';
  return {
    display: 'inline-flex',
    padding: '2px 8px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    background: isArt ? '#E3F5F5' : '#E8EDF8',
    color: isArt ? '#0B7285' : '#1B3A6B',
  };
}

export default function AgendaPage() {
  const hoy = new Date();
  const [año, setAño] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [vencimientos, setVencimientos] = useState<VencimientoAgendaItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(hoy.getDate());

  useEffect(() => {
    setCargando(true);
    setError(null);
    listarVencimientosRango(primerDiaMes(año, mes), ultimoDiaMes(año, mes))
      .then(setVencimientos)
      .catch(() => setError('No se pudieron cargar los vencimientos.'))
      .finally(() => setCargando(false));
  }, [año, mes]);

  const irMesPrev = () => {
    setSelectedDay(null);
    if (mes === 0) { setMes(11); setAño((a) => a - 1); }
    else setMes((m) => m - 1);
  };

  const irMesSig = () => {
    setSelectedDay(null);
    if (mes === 11) { setMes(0); setAño((a) => a + 1); }
    else setMes((m) => m + 1);
  };

  // Items del panel lateral para el día seleccionado
  const panelFecha = selectedDay ? isoFecha(año, mes, selectedDay) : null;
  const panelItems = panelFecha
    ? vencimientos.filter((v) => v.fecha.slice(0, 10) === panelFecha)
    : [];

  const esHoySelected =
    selectedDay === hoy.getDate() &&
    mes === hoy.getMonth() &&
    año === hoy.getFullYear();

  const panelTitulo = selectedDay
    ? `${selectedDay} de ${MESES_ES[mes]} de ${año}`
    : 'Seleccioná un día';

  const panelSubtitulo = esHoySelected
    ? 'Hoy'
    : panelItems.length > 0
    ? `${panelItems.length} movimiento${panelItems.length !== 1 ? 's' : ''}`
    : selectedDay
    ? 'Sin movimientos'
    : 'Hacé clic en un día con eventos';

  return (
    <div style={{ padding: '32px 28px', fontFamily: 'Inter, sans-serif' }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 26,
          fontWeight: 700,
          color: '#131C2E',
        }}>
          Agenda
        </h1>
        <div style={{ fontSize: 13, color: '#8B95A5', marginTop: 4 }}>
          Plazos en días hábiles judiciales · Compartida por todo el estudio
        </div>
      </div>

      {cargando && (
        <div style={{ textAlign: 'center', color: '#8B95A5', fontSize: 13, padding: '60px 0' }}>
          Cargando…
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', color: '#C9423A', fontSize: 13, padding: '20px 0' }}>
          {error}
        </div>
      )}

      {!cargando && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          {/* Calendario */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #E5E2D8',
            overflow: 'hidden',
          }}>
            <CalendarioMes
              año={año}
              mes={mes}
              vencimientos={vencimientos}
              onPrev={irMesPrev}
              onNext={irMesSig}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          </div>

          {/* Panel lateral */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #E5E2D8',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Cabecera del panel */}
            <div style={{
              padding: '16px 18px',
              borderBottom: '1px solid #E9E6DE',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#131C2E' }}>{panelTitulo}</h3>
                <div style={{ fontSize: 11, color: '#8B95A5', marginTop: 2 }}>{panelSubtitulo}</div>
              </div>
              {panelItems.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  background: '#E8EDF8',
                  borderRadius: 20,
                  flexShrink: 0,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1B3A6B' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1B3A6B' }}>
                    {panelItems.length} mov.
                  </span>
                </div>
              )}
            </div>

            {/* Lista de items */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {panelItems.length > 0 ? (
                panelItems.map((v) => {
                  const isArt = v.area_caso === 'ART';
                  const borderColor = isArt ? '#0B7285' : '#1B3A6B';
                  return (
                    <div
                      key={v.id}
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid #F2F0EA',
                        borderLeft: `3px solid ${borderColor}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <span style={areaBadgeStyle(v.area_caso)}>
                          {isArt ? 'ART' : 'Laboral'}
                        </span>
                        {v.completado && (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#16A34A',
                            background: '#E6F4EE',
                            padding: '2px 7px',
                            borderRadius: 8,
                          }}>
                            COMPLETADO
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: v.completado ? '#8B95A5' : '#131C2E',
                        lineHeight: 1.4,
                        textDecoration: v.completado ? 'line-through' : 'none',
                      }}>
                        {v.descripcion}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '32px 18px', textAlign: 'center', color: '#B0A89C' }}>
                  <svg
                    width="28" height="28" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }}
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <div style={{ fontSize: 13 }}>
                    {selectedDay
                      ? 'Sin movimientos este día'
                      : 'Hacé clic en un día para ver el detalle'}
                  </div>
                </div>
              )}
            </div>

            {/* Aviso días hábiles */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid #E9E6DE' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 12px',
                background: '#FFF9EC',
                border: '1px solid #F5D99A',
                borderRadius: 8,
              }}>
                <svg
                  width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="#C9A028" strokeWidth="2"
                  style={{ flexShrink: 0, marginTop: 1 }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div style={{ fontSize: 11, color: '#8B5E08', lineHeight: 1.5 }}>
                  Plazos en días hábiles judiciales. Verificar feriados locales.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
