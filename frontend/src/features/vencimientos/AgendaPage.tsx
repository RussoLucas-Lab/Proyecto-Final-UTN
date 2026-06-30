import React, { useEffect, useState } from 'react';
import { listarVencimientosRango } from './api';
import { CalendarioMes } from './components/CalendarioMes';
import type { VencimientoResponse } from './types';

function primerDiaMes(año: number, mes: number): string {
  return `${año}-${String(mes + 1).padStart(2, '0')}-01`;
}

function ultimoDiaMes(año: number, mes: number): string {
  const ultimo = new Date(año, mes + 1, 0).getDate();
  return `${año}-${String(mes + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

export default function AgendaPage() {
  const hoy = new Date();
  const [año, setAño] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [vencimientos, setVencimientos] = useState<VencimientoResponse[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    listarVencimientosRango(primerDiaMes(año, mes), ultimoDiaMes(año, mes))
      .then(setVencimientos)
      .catch(() => setError('No se pudieron cargar los vencimientos.'))
      .finally(() => setCargando(false));
  }, [año, mes]);

  const irMesPrev = () => {
    if (mes === 0) { setMes(11); setAño((a) => a - 1); }
    else setMes((m) => m - 1);
  };

  const irMesSig = () => {
    if (mes === 11) { setMes(0); setAño((a) => a + 1); }
    else setMes((m) => m + 1);
  };

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#131C2E', marginBottom: 24, fontFamily: 'Inter, sans-serif' }}>
        Agenda de vencimientos
      </h1>

      <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E2D8', padding: 28 }}>
        {cargando ? (
          <div style={{ textAlign: 'center', color: '#8B95A5', fontSize: 13, padding: '40px 0' }}>
            Cargando…
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: '#C9423A', fontSize: 13, padding: '20px 0' }}>
            {error}
          </div>
        ) : (
          <CalendarioMes
            año={año}
            mes={mes}
            vencimientos={vencimientos}
            onPrev={irMesPrev}
            onNext={irMesSig}
          />
        )}
      </div>

      {/* List view below the calendar */}
      {!cargando && !error && vencimientos.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12, fontFamily: 'Inter, sans-serif' }}>
            Vencimientos del mes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...vencimientos]
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: v.completado ? '#F0FDF4' : '#F7F6F1',
                    borderRadius: 8, border: `1px solid ${v.completado ? '#BBF7D0' : '#E9E6DE'}`,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: '#8B95A5',
                    minWidth: 70, flexShrink: 0,
                  }}>
                    {v.fecha.slice(8, 10)}/{v.fecha.slice(5, 7)}
                  </div>
                  <div style={{
                    flex: 1, fontSize: 13, color: v.completado ? '#6B7280' : '#131C2E',
                    textDecoration: v.completado ? 'line-through' : 'none',
                  }}>
                    {v.descripcion}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: v.completado ? '#16A34A' : '#B45309',
                  }}>
                    {v.completado ? 'Completado' : 'Pendiente'}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {!cargando && !error && vencimientos.length === 0 && (
        <div style={{ textAlign: 'center', color: '#8B95A5', fontSize: 13, padding: '20px 0', fontFamily: 'Inter, sans-serif' }}>
          Sin vencimientos en este mes.
        </div>
      )}
    </div>
  );
}
