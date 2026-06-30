import React from 'react';
import type { VencimientoResponse } from '../types';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Props {
  año: number;
  mes: number; // 0-based
  vencimientos: VencimientoResponse[];
  onPrev: () => void;
  onNext: () => void;
}

function isoFecha(año: number, mes: number, dia: number): string {
  return `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function CalendarioMes({ año, mes, vencimientos, onPrev, onNext }: Props) {
  const primerDia = new Date(año, mes, 1).getDay(); // 0=Dom
  const diasEnMes = new Date(año, mes + 1, 0).getDate();

  // Group vencimientos by fecha ISO string
  const porFecha = new Map<string, VencimientoResponse[]>();
  for (const v of vencimientos) {
    const key = v.fecha.slice(0, 10);
    if (!porFecha.has(key)) porFecha.set(key, []);
    porFecha.get(key)!.push(v);
  }

  const hoy = new Date();
  const esHoy = (dia: number) =>
    hoy.getFullYear() === año && hoy.getMonth() === mes && hoy.getDate() === dia;

  // Build grid cells: empty prefix + days
  const celdas: (number | null)[] = [
    ...Array(primerDia).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={onPrev}
          style={{
            background: 'none', border: '1px solid #E5E2D8', borderRadius: 6,
            padding: '5px 12px', cursor: 'pointer', fontSize: 14, color: '#4B5563',
          }}
        >
          ‹
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#131C2E' }}>
          {MESES[mes]} {año}
        </span>
        <button
          onClick={onNext}
          style={{
            background: 'none', border: '1px solid #E5E2D8', borderRadius: 6,
            padding: '5px 12px', cursor: 'pointer', fontSize: 14, color: '#4B5563',
          }}
        >
          ›
        </button>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DIAS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#8B95A5', padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {celdas.map((dia, idx) => {
          if (dia === null) {
            return <div key={`e-${idx}`} style={{ minHeight: 56 }} />;
          }
          const fecha = isoFecha(año, mes, dia);
          const items = porFecha.get(fecha) ?? [];
          const pendientes = items.filter((v) => !v.completado);
          const completados = items.filter((v) => v.completado);
          const hoyClass = esHoy(dia);

          return (
            <div
              key={dia}
              title={items.map((v) => `${v.completado ? '✓' : '•'} ${v.descripcion}`).join('\n') || undefined}
              style={{
                minHeight: 56, padding: '5px 4px',
                border: hoyClass ? '2px solid #1B3A6B' : '1px solid #E9E6DE',
                borderRadius: 7,
                background: hoyClass ? '#EEF2F9' : '#FAFAF8',
                cursor: items.length ? 'default' : undefined,
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: hoyClass ? 700 : 400,
                color: hoyClass ? '#1B3A6B' : '#4B5563',
                textAlign: 'right', marginBottom: 3,
              }}>
                {dia}
              </div>
              {/* Pending badges */}
              {pendientes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {pendientes.slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      title={v.descripcion}
                      style={{
                        height: 6, width: 6, borderRadius: '50%',
                        background: '#1B3A6B', flexShrink: 0,
                      }}
                    />
                  ))}
                  {pendientes.length > 3 && (
                    <span style={{ fontSize: 9, color: '#1B3A6B', fontWeight: 600 }}>+{pendientes.length - 3}</span>
                  )}
                </div>
              )}
              {/* Completed badges */}
              {completados.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                  {completados.slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      title={v.descripcion}
                      style={{
                        height: 6, width: 6, borderRadius: '50%',
                        background: '#16A34A', flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              )}
              {/* Inline list for days with items (show on hover via title tooltip) */}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: '#6B7280' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1B3A6B' }} />
          Pendiente
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} />
          Completado
        </div>
      </div>
    </div>
  );
}
