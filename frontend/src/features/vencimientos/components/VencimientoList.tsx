import React, { useState } from 'react';
import { completarVencimiento } from '../api';
import type { VencimientoResponse } from '../types';

function formatFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

interface Props {
  vencimientos: VencimientoResponse[];
  onChange: (updated: VencimientoResponse) => void;
}

export function VencimientoList({ vencimientos, onChange }: Props) {
  const [completing, setCompleting] = useState<number | null>(null);

  if (vencimientos.length === 0) {
    return (
      <div style={{ fontSize: 13, color: '#8B95A5', textAlign: 'center', padding: '10px 0' }}>
        Sin vencimientos registrados
      </div>
    );
  }

  const handleCompletar = async (v: VencimientoResponse) => {
    setCompleting(v.id);
    try {
      const updated = await completarVencimiento(v.id, true);
      onChange(updated);
    } catch {
      alert('No se pudo actualizar el vencimiento.');
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {vencimientos.map((v) => (
        <div
          key={v.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', background: v.completado ? '#F0FDF4' : '#F7F6F1',
            borderRadius: 8, border: `1px solid ${v.completado ? '#BBF7D0' : '#E9E6DE'}`,
          }}
        >
          {/* Estado */}
          <div style={{
            width: 20, height: 20, flexShrink: 0,
            borderRadius: 4, border: `2px solid ${v.completado ? '#16A34A' : '#D8D4CA'}`,
            background: v.completado ? '#16A34A' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {v.completado && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          {/* Descripción */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 500,
              color: v.completado ? '#6B7280' : '#131C2E',
              textDecoration: v.completado ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {v.descripcion}
            </div>
          </div>

          {/* Fecha */}
          <div style={{ fontSize: 12, color: '#8B95A5', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatFecha(v.fecha)}
          </div>

          {/* Botón completar */}
          {!v.completado && (
            <button
              onClick={() => handleCompletar(v)}
              disabled={completing === v.id}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 500,
                border: '1px solid #D8D4CA', borderRadius: 5,
                background: 'none', color: '#1B3A6B', cursor: completing === v.id ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', opacity: completing === v.id ? 0.6 : 1,
              }}
            >
              {completing === v.id ? '…' : 'Completar'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
