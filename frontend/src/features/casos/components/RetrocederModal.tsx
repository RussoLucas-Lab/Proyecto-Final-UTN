/**
 * Modal de confirmación para retroceder una etapa (RN-09).
 *
 * El retroceso requiere confirmación explícita del usuario (botón "Confirmar retroceso").
 * La etapa destino se selecciona del historial del caso (anterior, no del catálogo).
 *
 * No asume nada sobre las etapas — los ids y nombres vienen como props.
 */
import React, { useState } from 'react';
import type { Etapa } from '../types';

interface RetrocederModalProps {
  etapaActual: Etapa;
  /** Etapas a las que el usuario puede retroceder (filtradas por área en el service). */
  etapasDisponibles: Etapa[];
  onConfirmar: (etapaDestinoId: number) => Promise<void>;
  onCancelar: () => void;
}

export function RetrocederModal({
  etapaActual,
  etapasDisponibles,
  onConfirmar,
  onCancelar,
}: RetrocederModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    etapasDisponibles.length === 1 ? etapasDisponibles[0].id : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmar() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirmar(selectedId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409')) {
        setError(
          'No se puede retroceder: la etapa destino no pertenece al mismo área, ' +
          'o la operación requiere confirmación previa.',
        );
      } else {
        setError('Error al retroceder. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancelar()}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          padding: 28,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#FEE4E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            ⚠
          </div>
          <div>
            <h3
              style={{
                margin: '0 0 4px',
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
                color: '#1F2937',
              }}
            >
              Retroceder etapa
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: '#6B7280',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Etapa actual:{' '}
              <strong style={{ color: '#374151' }}>{etapaActual.nombre}</strong>
            </p>
          </div>
        </div>

        {/* Aviso */}
        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #F59E0B',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: '#92400E',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Esta acción retrocede el caso a una etapa anterior. El historial queda
          registrado y no puede deshacerse.
        </div>

        {/* Selección de etapa destino */}
        {etapasDisponibles.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: '#9BA8B8',
              fontStyle: 'italic',
              fontFamily: 'Inter, sans-serif',
              marginBottom: 20,
            }}
          >
            No hay etapas disponibles para retroceder.
          </p>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 11,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                color: '#7B8799',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Retroceder a
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {etapasDisponibles.map((etapa) => (
                <label
                  key={etapa.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    border: selectedId === etapa.id
                      ? '2px solid #C9423A'
                      : '1.5px solid #E5E2D8',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selectedId === etapa.id ? '#FEF2F2' : '#FAFAF7',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    color: '#374151',
                    transition: 'all 0.1s',
                  }}
                >
                  <input
                    type="radio"
                    name="etapa_destino"
                    value={etapa.id}
                    checked={selectedId === etapa.id}
                    onChange={() => setSelectedId(etapa.id)}
                    style={{ accentColor: '#C9423A' }}
                  />
                  <span>
                    {etapa.nombre}
                    <span
                      style={{ marginLeft: 6, fontSize: 11, color: '#9BA8B8' }}
                    >
                      (Orden {etapa.orden})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: '8px 14px',
              marginBottom: 16,
              fontSize: 12,
              color: '#991B1B',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {error}
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancelar}
            disabled={loading}
            style={{
              padding: '9px 18px',
              border: '1.5px solid #E5E2D8',
              borderRadius: 8,
              background: '#FAFAF7',
              color: '#5A6478',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleConfirmar()}
            disabled={!selectedId || loading || etapasDisponibles.length === 0}
            style={{
              padding: '9px 18px',
              border: 'none',
              borderRadius: 8,
              background:
                !selectedId || loading || etapasDisponibles.length === 0
                  ? '#C0C9D4'
                  : '#C9423A',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor:
                !selectedId || loading || etapasDisponibles.length === 0
                  ? 'not-allowed'
                  : 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {loading ? 'Retrocediendo…' : 'Confirmar retroceso'}
          </button>
        </div>
      </div>
    </div>
  );
}
