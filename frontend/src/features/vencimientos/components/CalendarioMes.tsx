import React from 'react';
import type { VencimientoAgendaItem } from '../types';

const DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Props {
  año: number;
  mes: number; // 0-based
  vencimientos: VencimientoAgendaItem[];
  onPrev: () => void;
  onNext: () => void;
  selectedDay: number | null;
  onSelectDay: (dia: number | null) => void;
}

function isoFecha(año: number, mes: number, dia: number): string {
  return `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function chipStyle(area: string, completado: boolean): React.CSSProperties {
  const isArt = area === 'ART';
  const bg = completado ? '#F0FDF4' : isArt ? '#E3F5F5' : '#E8EDF8';
  const color = completado ? '#16A34A' : isArt ? '#0B7285' : '#1B3A6B';
  return {
    display: 'block',
    fontSize: 10,
    fontWeight: 500,
    padding: '2px 5px',
    borderRadius: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: 3,
    background: bg,
    color,
    textDecoration: completado ? 'line-through' : 'none',
    fontFamily: 'Inter, sans-serif',
  };
}

export function CalendarioMes({
  año, mes, vencimientos, onPrev, onNext, selectedDay, onSelectDay,
}: Props) {
  const primerDow = new Date(año, mes, 1).getDay(); // 0=Dom
  const offsetLunes = (primerDow + 6) % 7;           // 0=Lun, 6=Dom
  const diasEnMes = new Date(año, mes + 1, 0).getDate();

  const porFecha = new Map<string, VencimientoAgendaItem[]>();
  for (const v of vencimientos) {
    const key = v.fecha.slice(0, 10);
    if (!porFecha.has(key)) porFecha.set(key, []);
    porFecha.get(key)!.push(v);
  }

  const hoy = new Date();
  const esHoy = (dia: number) =>
    hoy.getFullYear() === año && hoy.getMonth() === mes && hoy.getDate() === dia;

  const celdas: (number | null)[] = [
    ...Array(offsetLunes).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Navegación de mes */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #E9E6DE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button
          onClick={onPrev}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A6478', padding: '4px 8px', borderRadius: 6 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#131C2E' }}>
          {MESES[mes]} {año}
        </h2>
        <button
          onClick={onNext}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A6478', padding: '4px 8px', borderRadius: 6 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Cabecera días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E9E6DE' }}>
        {DIAS_SEMANA.map((d, i) => (
          <div key={d} style={{
            padding: '8px 0',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: i >= 5 ? '#B0A89C' : '#7B8799',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grilla de celdas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {celdas.map((dia, idx) => {
          if (dia === null) {
            return (
              <div
                key={`e-${idx}`}
                style={{
                  padding: '8px 6px',
                  borderRight: '1px solid #F2F0EA',
                  borderBottom: '1px solid #F2F0EA',
                  minHeight: 76,
                  background: '#FAFAF7',
                }}
              />
            );
          }

          const fecha = isoFecha(año, mes, dia);
          const items = porFecha.get(fecha) ?? [];
          const visible = items.slice(0, 2);
          const overflow = items.length - 2;
          const today = esHoy(dia);
          const selected = dia === selectedDay;
          const dow = new Date(año, mes, dia).getDay();
          const isWeekend = dow === 0 || dow === 6;

          const numBg = selected ? '#1B3A6B' : today ? '#E8EDF8' : 'transparent';
          const numColor = selected ? '#FFFFFF' : today ? '#1B3A6B' : isWeekend ? '#B0A89C' : '#131C2E';
          const cellBg = selected ? '#F0F4FC' : isWeekend ? '#FAFAF7' : '#FFFFFF';

          return (
            <div
              key={dia}
              onClick={() => {
                if (items.length > 0) onSelectDay(selected ? null : dia);
              }}
              style={{
                padding: '8px 6px',
                borderRight: '1px solid #F2F0EA',
                borderBottom: '1px solid #F2F0EA',
                minHeight: 76,
                minWidth: 0,
                background: cellBg,
                cursor: items.length > 0 ? 'pointer' : 'default',
                transition: 'background .1s',
              }}
            >
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: numBg,
                color: numColor,
                fontSize: 13,
                fontWeight: (today || items.length > 0 || selected) ? 700 : 400,
                border: today && !selected ? '2px solid #1B3A6B' : 'none',
              }}>
                {dia}
              </div>
              {visible.map((v) => (
                <div key={v.id} style={chipStyle(v.area_caso, v.completado)}>
                  {v.descripcion}
                </div>
              ))}
              {overflow > 0 && (
                <div style={{
                  display: 'inline-block',
                  marginTop: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#1B3A6B',
                  background: '#E8EDF8',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}>
                  +{overflow} más
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid #F2F0EA',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#E8EDF8' }} />
          <span style={{ fontSize: 11, color: '#7B8799' }}>Laboral</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#E3F5F5' }} />
          <span style={{ fontSize: 11, color: '#7B8799' }}>ART</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#E6F4EE' }} />
          <span style={{ fontSize: 11, color: '#7B8799' }}>Completado</span>
        </div>
        <span style={{ fontSize: 11, color: '#B0A89C', marginLeft: 'auto' }}>
          Hacé clic en un día para ver el detalle
        </span>
      </div>
    </div>
  );
}
