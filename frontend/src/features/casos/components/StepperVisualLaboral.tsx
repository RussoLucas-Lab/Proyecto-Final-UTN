import React from 'react';
import type { Etapa } from '../types';

interface Props {
  etapas: Etapa[];
  etapaActualId: number;
}

type StepState = 'completed' | 'active' | 'pending';

const PRIMARY = '#1B3A6B';
const LIGHT_BG = '#E8EDF8';

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
    marginTop: 6,
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.3,
    color: state === 'pending' ? '#A0A8B4' : state === 'active' ? PRIMARY : '#5A6478',
    fontWeight: state === 'active' ? 700 : 500,
    maxWidth: 80,
  };
}

function lineColor(traversed: boolean) {
  return traversed ? PRIMARY : '#E9E6DE';
}

interface StepItemProps {
  etapa: Etapa;
  state: StepState;
  notFirst: boolean;
  notLast: boolean;
  isTerminal?: boolean;
}

function StepItem({ etapa, state, notFirst, notLast, isTerminal }: StepItemProps) {
  const leftTraversed = state !== 'pending';
  const rightTraversed = state === 'completed';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        minWidth: 72,
        padding: '0 2px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        {notFirst && (
          <div style={{ flex: 1, height: 2, background: lineColor(leftTraversed) }} />
        )}
        <div style={dotStyle(state)}>
          {state === 'completed' ? '✓' : state === 'active' ? '●' : ''}
        </div>
        {notLast && (
          <div style={{ flex: 1, height: 2, background: lineColor(rightTraversed) }} />
        )}
      </div>
      <div style={lblStyle(state)}>{etapa.nombre}</div>
      {isTerminal && (
        <div style={{ fontSize: 9, color: '#8B95A5', marginTop: 2 }}>cierre</div>
      )}
    </div>
  );
}

interface ForkBoxProps {
  icon: string;
  label: string;
  sublabel: string;
  active: boolean;
  isLast?: boolean;
}

function ForkBox({ icon, label, sublabel, active, isLast }: ForkBoxProps) {
  return (
    <div
      style={{
        padding: '12px 14px',
        textAlign: 'center',
        background: active ? LIGHT_BG : '#F7F6F1',
        color: active ? PRIMARY : '#7B8799',
        borderRight: isLast ? 'none' : '1px solid #E5E2D8',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
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
        {label}
      </div>
      <div style={{ fontSize: 11, opacity: 0.75, fontFamily: 'Inter, sans-serif' }}>{sublabel}</div>
    </div>
  );
}

function PhaseLabel({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, ...style }}>
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

export function StepperVisualLaboral({ etapas, etapaActualId }: Props) {
  const etapaActual = etapas.find((e) => e.id === etapaActualId);
  if (!etapaActual || etapas.length === 0) return null;

  const extrajudicial = etapas
    .filter((e) => e.fase === 'EXTRAJUDICIAL')
    .sort((a, b) => a.orden - b.orden);
  const judicial = etapas
    .filter((e) => e.fase === 'JUDICIAL')
    .sort((a, b) => a.orden - b.orden);

  const trunk = extrajudicial.filter((e) => !e.es_terminal);
  const acuerdo = extrajudicial.find((e) => e.es_terminal);

  const isJudicial = etapaActual.fase === 'JUDICIAL';
  const acuerdoReached = acuerdo?.id === etapaActualId;

  return (
    <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #F2F0EA' }}>
      <PhaseLabel text="Extrajudicial" />

      {/* Stepper extrajudicial */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          overflowX: 'auto',
          paddingBottom: 6,
        }}
      >
        {trunk.map((etapa, i) => (
          <StepItem
            key={etapa.id}
            etapa={etapa}
            state={getStepState(etapa, etapaActual)}
            notFirst={i > 0}
            notLast={true}
          />
        ))}
      </div>

      {/* Fork: Acuerdo / Sin acuerdo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          marginTop: 10,
          border: '1px solid #E5E2D8',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <ForkBox
          icon="✓"
          label={acuerdo?.nombre ?? 'Acuerdo'}
          sublabel="Cierre del caso"
          active={acuerdoReached}
        />
        <ForkBox
          icon="↓"
          label="Sin acuerdo"
          sublabel="Continúa a juicio"
          active={isJudicial}
          isLast
        />
      </div>

      {/* Fase judicial */}
      {isJudicial && (
        <div style={{ marginTop: 16 }}>
          <PhaseLabel text="Judicial" />
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {judicial.map((etapa, i) => (
              <StepItem
                key={etapa.id}
                etapa={etapa}
                state={getStepState(etapa, etapaActual)}
                notFirst={i > 0}
                notLast={i < judicial.length - 1}
                isTerminal={etapa.es_terminal}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
