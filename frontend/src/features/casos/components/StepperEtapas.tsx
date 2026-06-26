/**
 * Stepper de etapas del caso — completamente data-driven (ADR-0008).
 *
 * Muestra la etapa actual y las transiciones válidas disponibles (avanzar).
 * Nunca hardcodea nombres de etapa: toda la info viene de `etapa_actual`
 * y `transiciones_validas` del endpoint GET /casos/{id}.
 *
 * Props:
 *   etapaActual        — etapa en la que está el caso
 *   transicionesValidas — etapas a las que se puede avanzar
 *   onAvanzar          — callback con el id de la etapa destino
 *   onRetroceder       — abre el modal de confirmación de retroceso
 *   isLoading          — deshabilita acciones mientras se procesa
 *   area               — para colorear (LABORAL vs ART)
 */
import React, { useState } from 'react';
import type { AreaDerecho, Etapa } from '../types';

interface StepperEtapasProps {
  etapaActual: Etapa;
  transicionesValidas: Etapa[];
  onAvanzar: (etapaDestinoId: number) => Promise<void>;
  onRetroceder: () => void;
  isLoading?: boolean;
  area: AreaDerecho;
}

export function StepperEtapas({
  etapaActual,
  transicionesValidas,
  onAvanzar,
  onRetroceder,
  isLoading = false,
  area,
}: StepperEtapasProps) {
  const [selectedDestino, setSelectedDestino] = useState<number | null>(
    transicionesValidas.length === 1 ? transicionesValidas[0].id : null,
  );
  const [advancing, setAdvancing] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const primaryColor = area === 'LABORAL' ? '#1B3A6B' : '#0B7285';
  const lightBg = area === 'LABORAL' ? '#E8EDF8' : '#E3F5F5';

  async function handleAvanzar() {
    if (!selectedDestino) return;
    setAdvancing(true);
    setErrorLocal(null);
    try {
      await onAvanzar(selectedDestino);
      setSelectedDestino(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409')) {
        setErrorLocal('Transición no permitida. La etapa seleccionada no es alcanzable desde la etapa actual.');
      } else {
        setErrorLocal('Error al avanzar. Intentá de nuevo.');
      }
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E2D8',
        borderRadius: 12,
        padding: '18px 22px',
      }}
    >
      {/* Etapa actual */}
      <div style={{ marginBottom: 16 }}>
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
          Etapa actual
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              background: lightBg,
              color: primaryColor,
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {etapaActual.nombre}
          </span>
          <span
            style={{ fontSize: 12, color: '#9BA8B8', fontFamily: 'Inter, sans-serif' }}
          >
            {etapaActual.fase} · Orden {etapaActual.orden}
          </span>
          {etapaActual.es_terminal && (
            <span
              style={{
                background: '#E6F4EE',
                color: '#1A7A4A',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Etapa terminal
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {errorLocal && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '8px 14px',
            marginBottom: 12,
            fontSize: 12,
            color: '#991B1B',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {errorLocal}
        </div>
      )}

      {/* Transiciones válidas */}
      {transicionesValidas.length > 0 ? (
        <div>
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
            Avanzar a
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {transicionesValidas.map((etapa) => (
              <button
                key={etapa.id}
                onClick={() => setSelectedDestino(etapa.id)}
                style={{
                  border: selectedDestino === etapa.id
                    ? `2px solid ${primaryColor}`
                    : '1.5px solid #E5E2D8',
                  background: selectedDestino === etapa.id ? lightBg : '#FAFAF7',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: selectedDestino === etapa.id ? 700 : 500,
                  color: selectedDestino === etapa.id ? primaryColor : '#5A6478',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.1s',
                }}
              >
                {etapa.nombre}
              </button>
            ))}
          </div>
          <button
            onClick={() => void handleAvanzar()}
            disabled={!selectedDestino || advancing || isLoading}
            style={{
              background: !selectedDestino || advancing || isLoading ? '#C0C9D4' : primaryColor,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '9px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: !selectedDestino || advancing || isLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              marginRight: 8,
            }}
          >
            {advancing ? 'Avanzando…' : 'Confirmar avance →'}
          </button>
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: '#9BA8B8',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'italic',
          }}
        >
          No hay transiciones disponibles desde esta etapa.
        </p>
      )}

      {/* Retroceder */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F2F0EA' }}>
        <button
          onClick={onRetroceder}
          disabled={isLoading}
          style={{
            background: '#FEE4E2',
            color: '#C9423A',
            border: '1px solid #F5C2C0',
            borderRadius: 8,
            padding: '7px 16px',
            fontSize: 12,
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Retroceder etapa…
        </button>
      </div>
    </div>
  );
}
