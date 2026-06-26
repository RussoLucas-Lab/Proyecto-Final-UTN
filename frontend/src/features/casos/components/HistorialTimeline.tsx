/**
 * Timeline del historial inmutable del caso (RN-05, RN-06).
 *
 * Muestra las entradas en orden cronológico (índice 0 = primera).
 * NUNCA interpreta los nombres de etapa: los muestra tal cual vienen del backend.
 * El historial es append-only: no hay acciones de edición o eliminación.
 */
import React from 'react';
import type { HistorialItem } from '../types';

interface HistorialTimelineProps {
  historial: HistorialItem[];
}

const EVENTO_LABEL: Record<string, string> = {
  'creación': 'Alta',
  'avance': 'Avance',
  'retroceso': 'Retroceso',
};

const EVENTO_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  'creación': { bg: '#EDF7F0', color: '#1A7A4A', border: '#B4DECA' },
  'avance': { bg: '#E8EDF8', color: '#1B3A6B', border: '#B0C0E0' },
  'retroceso': { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
};

function formatFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function HistorialTimeline({ historial }: HistorialTimelineProps) {
  if (historial.length === 0) {
    return (
      <p
        style={{
          color: '#9BA8B8',
          fontSize: 13,
          fontStyle: 'italic',
          fontFamily: 'Inter, sans-serif',
          margin: 0,
        }}
      >
        Sin entradas en el historial.
      </p>
    );
  }

  return (
    <ol
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {historial.map((item, idx) => {
        const style = EVENTO_COLOR[item.evento] ?? {
          bg: '#F5F5F5',
          color: '#555',
          border: '#DDD',
        };
        const label = EVENTO_LABEL[item.evento] ?? item.evento;
        const isFirst = idx === 0;

        return (
          <li
            key={item.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            {/* Línea vertical + punto */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 20,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: style.color,
                  border: `2px solid ${style.border}`,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              {!isFirst && (
                <div
                  style={{
                    width: 2,
                    flexGrow: 1,
                    background: '#E5E2D8',
                    marginTop: 4,
                  }}
                />
              )}
            </div>

            {/* Contenido */}
            <div
              style={{
                background: '#FFFFFF',
                border: `1px solid ${style.border}`,
                borderRadius: 8,
                padding: '8px 14px',
                flex: 1,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    background: style.bg,
                    color: style.color,
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'Inter, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: '#9BA8B8',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {formatFecha(item.ocurrido_en)}
                </span>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#5A6478',
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {item.etapa_anterior_id !== null ? (
                  <>
                    <span>Etapa {item.etapa_anterior_id}</span>
                    <span style={{ color: '#C0C9D4' }}>→</span>
                  </>
                ) : (
                  <span style={{ color: '#9BA8B8', fontStyle: 'italic' }}>inicio</span>
                )}
                <span style={{ fontWeight: 600, color: '#374151' }}>
                  Etapa {item.etapa_nueva_id}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
