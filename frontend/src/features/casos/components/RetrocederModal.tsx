/**
 * Modal de confirmación para retroceder UNA etapa (RN-09).
 *
 * No muestra selección de etapas — siempre retrocede al paso inmediato anterior.
 * El abogado solo confirma o cancela.
 */
import React, { useState } from 'react';

interface RetrocederModalProps {
  etapaActualNombre: string;
  etapaDestinoId: number;
  etapaDestinoNombre: string;
  onConfirmar: (etapaDestinoId: number) => Promise<void>;
  onCancelar: () => void;
}

export function RetrocederModal({
  etapaActualNombre,
  etapaDestinoId,
  etapaDestinoNombre,
  onConfirmar,
  onCancelar,
}: RetrocederModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmar() {
    setLoading(true);
    setError(null);
    try {
      await onConfirmar(etapaDestinoId);
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
          maxWidth: 420,
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
              <strong style={{ color: '#374151' }}>{etapaActualNombre}</strong>
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
            marginBottom: 20,
            fontSize: 12,
            color: '#92400E',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Esta acción retrocede el caso a la etapa anterior. El historial queda
          registrado y no puede deshacerse.
        </div>

        {/* Destino */}
        <div
          style={{
            background: '#F9F8F5',
            border: '1.5px solid #E5E2D8',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#7B8799', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Retrocederá a
          </p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#C9423A' }}>
            {etapaDestinoNombre}
          </p>
        </div>

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
            disabled={loading}
            style={{
              padding: '9px 18px',
              border: 'none',
              borderRadius: 8,
              background: loading ? '#C0C9D4' : '#C9423A',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
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
