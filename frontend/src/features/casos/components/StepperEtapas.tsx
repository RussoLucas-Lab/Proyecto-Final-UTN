import React, { useState } from 'react';
import type { ResultadoTelegrama } from '../../telegramas/types';
import type { AreaDerecho, Etapa } from '../types';

const RESULTADO_LABELS: Record<string, string> = {
  ENTREGADO: 'Entregado',
  RECHAZADO: 'Rechazado',
  EN_SUCURSAL: 'En sucursal',
  DOMICILIO_INEXISTENTE: 'Domicilio inexistente',
  CERRADO: 'Domicilio cerrado',
};

interface StepperEtapasProps {
  etapaActual: Etapa;
  transicionesValidas: Etapa[];
  onAvanzar: (etapaDestinoId: number) => Promise<void>;
  onRetroceder?: () => void;
  isLoading?: boolean;
  avanzarBloqueado?: boolean;
  resultadoTelegrama?: ResultadoTelegrama | null;
  onSetResultadoTelegrama?: (resultado: ResultadoTelegrama) => Promise<void>;
  area: AreaDerecho;
}

export function StepperEtapas({
  etapaActual,
  transicionesValidas,
  onAvanzar,
  onRetroceder,
  isLoading = false,
  avanzarBloqueado = false,
  resultadoTelegrama,
  onSetResultadoTelegrama,
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
        setErrorLocal('Transición no permitida desde la etapa actual.');
      } else {
        setErrorLocal('Error al avanzar. Intentá de nuevo.');
      }
    } finally {
      setAdvancing(false);
    }
  }

  const canAdvance = !!selectedDestino && !advancing && !isLoading && !avanzarBloqueado;

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 12,
        border: '1px solid #E5E2D8',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          padding: '14px 18px',
          background: '#F7F6F1',
          borderBottom: '1px solid #E9E6DE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#7B8799',
            textTransform: 'uppercase',
            letterSpacing: '.8px',
          }}
        >
          Etapa actual
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#B0A89C',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '.5px',
          }}
        >
          {etapaActual.fase === 'EXTRAJUDICIAL' ? 'Extrajudicial' : 'Judicial'} · Orden{' '}
          {etapaActual.orden}
        </span>
      </div>

      {/* Badge etapa actual */}
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F2F0EA' }}>
        <span
          style={{
            background: lightBg,
            color: primaryColor,
            fontSize: 13,
            padding: '5px 14px',
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          {etapaActual.nombre}
        </span>
        {etapaActual.es_terminal && (
          <span
            style={{
              marginLeft: 8,
              background: '#E6F4EE',
              color: '#1A7A4A',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Etapa terminal
          </span>
        )}
      </div>

      {/* Resultado del telegrama */}
      {onSetResultadoTelegrama !== undefined && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F2F0EA' }}>
          <label
            style={{
              display: 'block',
              fontSize: 10,
              fontWeight: 700,
              color: '#7B8799',
              textTransform: 'uppercase',
              letterSpacing: '.8px',
              marginBottom: 8,
            }}
          >
            Resultado del telegrama
          </label>
          <select
            value={
              resultadoTelegrama && resultadoTelegrama !== 'PENDIENTE' ? resultadoTelegrama : ''
            }
            onChange={(e) => {
              if (e.target.value) {
                void onSetResultadoTelegrama(e.target.value as ResultadoTelegrama);
              }
            }}
            style={{
              width: '100%',
              height: 38,
              border: '1.5px solid #E5E2D8',
              borderRadius: 8,
              padding: '0 12px',
              fontSize: 13,
              color: '#131C2E',
              background: '#FAFAF7',
              cursor: 'pointer',
            }}
          >
            <option value="" disabled>
              — Sin registrar —
            </option>
            {Object.entries(RESULTADO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {avanzarBloqueado && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 11,
                color: '#C9423A',
              }}
            >
              Registrá el resultado para continuar
            </p>
          )}
        </div>
      )}

      {/* Avanzar a */}
      {transicionesValidas.length > 0 && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F2F0EA' }}>
          <label
            style={{
              display: 'block',
              fontSize: 10,
              fontWeight: 700,
              color: '#7B8799',
              textTransform: 'uppercase',
              letterSpacing: '.8px',
              marginBottom: 10,
            }}
          >
            Avanzar a
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: transicionesValidas.length > 1 ? '1fr 1fr' : '1fr',
              gap: 8,
            }}
          >
            {transicionesValidas.map((etapa) => (
              <button
                key={etapa.id}
                onClick={() => setSelectedDestino(etapa.id)}
                style={{
                  height: 36,
                  border:
                    selectedDestino === etapa.id
                      ? `1.5px solid ${primaryColor}`
                      : '1.5px solid #E5E2D8',
                  borderRadius: 8,
                  background: selectedDestino === etapa.id ? lightBg : '#FAFAF7',
                  color: selectedDestino === etapa.id ? primaryColor : '#5A6478',
                  fontSize: 12,
                  fontWeight: selectedDestino === etapa.id ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.1s',
                }}
              >
                {etapa.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {errorLocal && (
        <div
          style={{
            margin: '0 18px',
            marginTop: 8,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#991B1B',
          }}
        >
          {errorLocal}
        </div>
      )}

      {/* Acciones */}
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {transicionesValidas.length > 0 && (
          <button
            onClick={() => void handleAvanzar()}
            disabled={!canAdvance}
            style={{
              width: '100%',
              height: 40,
              background: canAdvance ? primaryColor : '#C0C9D4',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              cursor: canAdvance ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.1s',
            }}
          >
            {advancing ? 'Avanzando…' : 'Confirmar avance'}
            {!advancing && (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </button>
        )}

        {onRetroceder && (
          <button
            onClick={onRetroceder}
            disabled={isLoading}
            style={{
              width: '100%',
              height: 34,
              background: 'none',
              border: 'none',
              color: '#C9423A',
              fontSize: 12,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: 0.75,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Retroceder etapa…
          </button>
        )}

        {transicionesValidas.length === 0 && !onRetroceder && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: '#9BA8B8',
              fontStyle: 'italic',
              textAlign: 'center',
            }}
          >
            No hay transiciones disponibles.
          </p>
        )}
      </div>
    </div>
  );
}
