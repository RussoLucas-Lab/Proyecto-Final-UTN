import { useState } from 'react';
import { triggerRespaldoManual } from './api';
import { useRespaldos } from './hooks/useRespaldos';
import type { EstadoRespaldo, TipoRespaldo } from './types';

// ── Mapeos de enum a label legible ──────────────────────────────────────────

const TIPO_LABEL: Record<TipoRespaldo, string> = {
  AUTOMATICO: 'Automático',
  MANUAL: 'Manual',
};

const ESTADO_LABEL: Record<EstadoRespaldo, string> = {
  OK: 'OK',
  ERROR: 'Error',
};

// ── Helpers de fecha ─────────────────────────────────────────────────────────

function formatFecha(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatHora(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs';
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function IconDatabase() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 6, verticalAlign: 'middle' }}>
      <ellipse cx="8" cy="4" rx="5.5" ry="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 4v4c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8v4c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 4, verticalAlign: 'middle' }}>
      <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 10.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  background: '#1B3A6B',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  display: 'inline-flex',
  alignItems: 'center',
};

const btnSecondary: React.CSSProperties = {
  background: '#F2F0EA',
  color: '#5A6478',
  border: '1px solid #D8D4CA',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  display: 'inline-flex',
  alignItems: 'center',
};

const colHeaders = ['Fecha y hora', 'Tipo', 'Estado', 'Archivo', 'Acciones'];

// ── Componente principal ──────────────────────────────────────────────────────

export default function RespaldosPage() {
  const { respaldos, loading, error, refresh } = useRespaldos();
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const ultimoOk = respaldos.find(r => r.estado === 'OK');

  async function handleRespaldoManual() {
    setTriggering(true);
    setTriggerMsg(null);
    setTriggerError(null);
    try {
      const res = await triggerRespaldoManual();
      setTriggerMsg(res.mensaje);
      // Refrescar la lista después de un momento para dar tiempo a n8n
      setTimeout(() => refresh(), 3000);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : 'Error al iniciar el respaldo');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#131C2E', padding: '32px 36px', maxWidth: 900 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#131C2E', margin: 0, lineHeight: 1.2 }}>
            Respaldos
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7B8799', fontFamily: 'Inter, sans-serif' }}>
            Historial de respaldos automáticos y manuales
          </p>
        </div>
        <button
          style={{ ...btnPrimary, opacity: triggering ? 0.7 : 1 }}
          onClick={handleRespaldoManual}
          disabled={triggering}
        >
          <IconDatabase />
          {triggering ? 'Iniciando...' : 'Respaldo manual ahora'}
        </button>
      </div>

      {/* Feedback del trigger manual */}
      {triggerMsg && (
        <div style={{
          marginTop: 12,
          background: '#E6F4EE',
          border: '1px solid #A3D4B8',
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 13,
          color: '#1A7A4A',
          fontFamily: 'Inter, sans-serif',
        }}>
          {triggerMsg}
        </div>
      )}
      {triggerError && (
        <div style={{
          marginTop: 12,
          background: '#FEE4E2',
          border: '1px solid #F5C2C0',
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 13,
          color: '#C9423A',
          fontFamily: 'Inter, sans-serif',
        }}>
          {triggerError}
        </div>
      )}

      {/* Status banner */}
      <div style={{
        marginTop: 20,
        background: '#E6F4EE',
        border: '1px solid #A3D4B8',
        borderRadius: 10,
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#1A7A4A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <IconCheck />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A7A4A', fontFamily: 'Inter, sans-serif', lineHeight: 1.3 }}>
            Sistema protegido
          </div>
          <div style={{ fontSize: 12, color: '#2D8C5E', fontFamily: 'Inter, sans-serif', marginTop: 1 }}>
            {ultimoOk
              ? `Último respaldo: ${formatFecha(ultimoOk.fecha)} a las ${formatHora(ultimoOk.fecha)}`
              : 'Sin respaldos recientes'}
          </div>
        </div>
      </div>

      {/* Estado de carga o error */}
      {loading && (
        <div style={{ marginTop: 20, fontSize: 13, color: '#7B8799', fontFamily: 'Inter, sans-serif' }}>
          Cargando historial de respaldos…
        </div>
      )}
      {error && !loading && (
        <div style={{
          marginTop: 20,
          background: '#FEE4E2',
          border: '1px solid #F5C2C0',
          borderRadius: 10,
          padding: '12px 18px',
          fontSize: 13,
          color: '#C9423A',
          fontFamily: 'Inter, sans-serif',
        }}>
          Error al cargar los respaldos: {error}
        </div>
      )}

      {/* Backups table card */}
      {!loading && !error && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E2D8',
          borderRadius: 12,
          overflow: 'hidden',
          marginTop: 20,
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '180px 130px 110px 200px 150px',
            background: '#FAFAF7',
            borderBottom: '2px solid #E5E2D8',
          }}>
            {colHeaders.map(h => (
              <div key={h} style={{
                padding: '11px 16px',
                fontSize: 11,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#7B8799',
                letterSpacing: '0.04em',
              }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {respaldos.length === 0 ? (
            <div style={{ padding: '24px 16px', fontSize: 13, color: '#7B8799', fontFamily: 'Inter, sans-serif' }}>
              No hay respaldos registrados aún.
            </div>
          ) : (
            respaldos.map((b, idx) => (
              <div
                key={b.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 130px 110px 200px 150px',
                  borderBottom: idx < respaldos.length - 1 ? '1px solid #F2F0EA' : 'none',
                  alignItems: 'center',
                }}
              >
                {/* Fecha y hora */}
                <div style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
                    {formatFecha(b.fecha)}
                  </span>
                  {' '}
                  <span style={{ fontSize: 12, color: '#7B8799', fontFamily: 'Inter, sans-serif' }}>
                    {formatHora(b.fecha)}
                  </span>
                </div>

                {/* Tipo badge */}
                <div style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    background: b.tipo === 'MANUAL' ? '#E8EDF8' : '#F2F0EA',
                    color: b.tipo === 'MANUAL' ? '#1B3A6B' : '#5A6478',
                  }}>
                    {TIPO_LABEL[b.tipo]}
                  </span>
                </div>

                {/* Estado badge */}
                <div style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    background: b.estado === 'OK' ? '#E6F4EE' : '#FEE4E2',
                    color: b.estado === 'OK' ? '#1A7A4A' : '#C9423A',
                  }}>
                    {ESTADO_LABEL[b.estado]}
                  </span>
                </div>

                {/* Archivo */}
                <div style={{ padding: '12px 16px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#5A6478' }}>
                    {b.ubicacion ?? '—'}
                  </span>
                </div>

                {/* Acciones */}
                <div style={{ padding: '12px 16px' }}>
                  {b.estado === 'OK' && b.ubicacion ? (
                    <button style={btnSecondary}>
                      <IconDownload />
                      Descargar
                    </button>
                  ) : (
                    <button style={{
                      background: '#FEE4E2',
                      color: '#C9423A',
                      border: '1px solid #F5C2C0',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      Ver error
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Info note */}
      <p style={{
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
        color: '#7B8799',
        marginTop: 12,
        padding: '0 4px',
        lineHeight: 1.6,
      }}>
        Los respaldos automáticos se realizan todos los días a las 03:00 hs (hora de Argentina). Se conservan los últimos 30 días. Los respaldos manuales no cuentan para el límite.
      </p>
    </div>
  );
}
