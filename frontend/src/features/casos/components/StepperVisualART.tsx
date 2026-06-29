import React from 'react';
import type { Etapa, TipoReclamoArt } from '../types';

interface Props {
  etapas: Etapa[];
  etapaActualId: number;
  tipoReclamo: TipoReclamoArt | null;
}

type StepState = 'completed' | 'active' | 'pending';

const PRIMARY = '#0B7285';
const LIGHT_BG = '#E3F5F5';

function getStepState(etapa: Etapa, etapaActual: Etapa): StepState {
  if (etapa.id === etapaActual.id) return 'active';
  if (etapa.orden < etapaActual.orden) return 'completed';
  return 'pending';
}

function dotStyle(state: StepState): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: '50%',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    flexShrink: 0,
    fontFamily: 'Inter, sans-serif',
  };
  if (state === 'pending') {
    return { ...base, background: '#E9E6DE', border: '2px solid #A0A8B4', color: '#A0A8B4' };
  }
  return {
    ...base,
    background: PRIMARY,
    border: '3px solid #fff',
    boxShadow: `0 0 0 2px ${PRIMARY}`,
    color: '#fff',
  };
}

function lblStyle(state: StepState): React.CSSProperties {
  return {
    fontSize: 10,
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.3,
    color: state === 'pending' ? '#A0A8B4' : state === 'active' ? PRIMARY : '#5A6478',
    fontWeight: state === 'active' ? 700 : 500,
  };
}

function lineColor(traversed: boolean) {
  return traversed ? PRIMARY : '#E9E6DE';
}

interface StepItemProps {
  etapa: Etapa;
  state: StepState;
  isTerminal?: boolean;
}

function StepItem({ etapa, state, isTerminal }: StepItemProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 72, padding: '0 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <div style={{ flex: 1, height: 2, background: lineColor(state !== 'pending') }} />
        <div style={dotStyle(state)}>
          {state === 'completed' ? '✓' : state === 'active' ? '●' : ''}
        </div>
        <div style={{ flex: 1, height: 2, background: lineColor(state === 'completed') }} />
      </div>
      <div style={{ ...lblStyle(state), marginTop: 6, textAlign: 'center', maxWidth: 80 }}>{etapa.nombre}</div>
      {isTerminal && <div style={{ fontSize: 9, color: '#8B95A5', marginTop: 2 }}>cierre</div>}
    </div>
  );
}

function PhaseLabel({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.8px',
          textTransform: 'uppercase',
          color: '#7B8799',
          background: '#F2F0EA',
          padding: '2px 10px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: '#E9E6DE' }} />
    </div>
  );
}

export function StepperVisualART({ etapas, etapaActualId, tipoReclamo }: Props) {
  const etapaActual = etapas.find((e) => e.id === etapaActualId);
  if (!etapaActual || etapas.length === 0) return null;

  const extrajudicial = etapas
    .filter((e) => e.fase === 'EXTRAJUDICIAL')
    .sort((a, b) => a.orden - b.orden);
  const judicial = etapas
    .filter((e) => e.fase === 'JUDICIAL')
    .sort((a, b) => a.orden - b.orden);

  const nonTerminalExt = extrajudicial.filter((e) => !e.es_terminal);
  const toma = nonTerminalExt[0];         // orden 1: Toma del cliente
  const denunciaART = nonTerminalExt[1];  // orden 2: Denuncia ART (solo ENFERMEDAD)
  const srt = nonTerminalExt[2];          // orden 3: SRT / Comisión Médica
  const indemnizacion = extrajudicial.find((e) => e.es_terminal); // orden 4

  const isJudicial = etapaActual.fase === 'JUDICIAL';
  const indemnizacionReached = indemnizacion?.id === etapaActualId;

  const tomaState = toma ? getStepState(toma, etapaActual) : 'pending';
  const srtState = srt ? getStepState(srt, etapaActual) : 'pending';
  const denunciaState =
    denunciaART && tipoReclamo === 'ENFERMEDAD'
      ? getStepState(denunciaART, etapaActual)
      : 'pending';

  const accedenteActive = tipoReclamo === 'ACCIDENTE';
  const enfermedadActive = tipoReclamo === 'ENFERMEDAD';

  return (
    <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #F2F0EA' }}>
      <PhaseLabel text="Extrajudicial" />

      {/* Step 1: Toma del cliente */}
      {toma && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={dotStyle(tomaState)}>
            {tomaState === 'completed' ? '✓' : tomaState === 'active' ? '●' : ''}
          </div>
          <div style={lblStyle(tomaState)}>{toma.nombre}</div>
          <div style={{ flex: 1, height: 2, background: lineColor(tomaState !== 'pending') }} />
        </div>
      )}

      {/* Fork 1: Origen del reclamo */}
      <div
        style={{
          border: '1px solid #E5E2D8',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            padding: '8px 14px',
            background: '#F7F6F1',
            borderBottom: '1px solid #E9E6DE',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.7px',
              color: '#7B8799',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Origen del reclamo
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* Accidente */}
          <div
            style={{
              padding: '10px 14px',
              background: accedenteActive ? LIGHT_BG : '#F7F6F1',
              color: accedenteActive ? PRIMARY : '#7B8799',
              borderRight: '1px solid #E5E2D8',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 3,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Accidente laboral
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, fontFamily: 'Inter, sans-serif' }}>
              → SRT / Comisión Médica
            </div>
          </div>
          {/* Enfermedad */}
          <div
            style={{
              padding: '10px 14px',
              background: enfermedadActive ? LIGHT_BG : '#F7F6F1',
              color: enfermedadActive ? PRIMARY : '#7B8799',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 3,
              }}
            >
              {denunciaART && (
                <div style={{ ...dotStyle(denunciaState), width: 18, height: 18, fontSize: 9 }}>
                  {denunciaState === 'completed' ? '✓' : denunciaState === 'active' ? '●' : ''}
                </div>
              )}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Enfermedad profesional
              </div>
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, fontFamily: 'Inter, sans-serif' }}>
              Denuncia ART → SRT
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: SRT / Comisión Médica */}
      {srt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 2, background: lineColor(srtState !== 'pending') }} />
          <div style={dotStyle(srtState)}>
            {srtState === 'completed' ? '✓' : srtState === 'active' ? '●' : ''}
          </div>
          <div style={lblStyle(srtState)}>{srt.nombre}</div>
          <div style={{ flex: 1, height: 2, background: '#E9E6DE' }} />
        </div>
      )}

      {/* Fork 2: Resolución */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          border: '1px solid #E5E2D8',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            textAlign: 'center',
            background: indemnizacionReached ? LIGHT_BG : '#F7F6F1',
            color: indemnizacionReached ? PRIMARY : '#7B8799',
            borderRight: '1px solid #E5E2D8',
          }}
        >
          <div style={{ fontSize: 16, marginBottom: 4 }}>✓</div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.5px',
              marginBottom: 2,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Res. favorable
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, fontFamily: 'Inter, sans-serif' }}>
            {indemnizacion?.nombre ?? 'Indemnización'} → Cierre
          </div>
        </div>
        <div
          style={{
            padding: '12px 14px',
            textAlign: 'center',
            background: isJudicial ? LIGHT_BG : '#F7F6F1',
            color: isJudicial ? PRIMARY : '#7B8799',
          }}
        >
          <div style={{ fontSize: 16, marginBottom: 4 }}>↓</div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.5px',
              marginBottom: 2,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Desfavorable
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, fontFamily: 'Inter, sans-serif' }}>
            Continúa a juicio
          </div>
        </div>
      </div>

      {/* Fase judicial */}
      {isJudicial && (
        <div style={{ marginTop: 16 }}>
          <PhaseLabel text="Judicial" />
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {judicial.map((etapa) => (
              <StepItem
                key={etapa.id}
                etapa={etapa}
                state={getStepState(etapa, etapaActual)}
                isTerminal={etapa.es_terminal}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
