import React, { useState } from 'react';
import { crearVencimiento } from '../api';
import type { VencimientoResponse } from '../types';

interface Props {
  casoId: number;
  onCreado: (v: VencimientoResponse) => void;
}

export function VencimientoForm({ casoId, onCreado }: Props) {
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim() || !fecha) return;
    setLoading(true);
    setError(null);
    try {
      const v = await crearVencimiento(casoId, { descripcion: descripcion.trim(), fecha });
      onCreado(v);
      setDescripcion('');
      setFecha('');
    } catch {
      setError('No se pudo registrar el vencimiento. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: 2, minWidth: 180 }}>
        <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Descripción</label>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={255}
          placeholder="Ej: Presentar demanda"
          required
          style={{
            width: '100%', padding: '7px 10px', border: '1px solid #D8D4CA',
            borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
          style={{
            width: '100%', padding: '7px 10px', border: '1px solid #D8D4CA',
            borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
          }}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !descripcion.trim() || !fecha}
        style={{
          padding: '8px 14px', background: '#1B3A6B', color: '#fff',
          border: 'none', borderRadius: 6, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 500, opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'Guardando…' : 'Agregar'}
      </button>
      {error && <p style={{ width: '100%', fontSize: 12, color: '#C9423A', margin: '4px 0 0' }}>{error}</p>}
    </form>
  );
}
