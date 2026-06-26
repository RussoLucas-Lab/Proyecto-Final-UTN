/**
 * Página de creación de un caso nuevo (RF-08, RF-09).
 *
 * El area se elige en pantalla (no hardcodeada). Si es ART, pide tipo_reclamo.
 * La búsqueda de cliente es local/mock hasta que exista el autocomplete de clientes.
 * Al crear, llama a api.crear() y redirige a la página de detalle según el área.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as casosApi from './api';
import type { AreaDerecho, TipoReclamoArt } from './types';

const MOCK_ABOGADOS = [
  { id: 1, label: 'Dr. Martín Suárez (Socio)' },
  { id: 2, label: 'Dra. Laura Vega (Laboral)' },
  { id: 3, label: 'Dr. Pablo Rossi (ART)' },
];

const MOCK_CLIENTES = [
  { id: 1, nombre: 'González Pérez, Carlos', dni: '28.456.123' },
  { id: 2, nombre: 'Martínez Rojas, Ana', dni: '31.112.005' },
  { id: 3, nombre: 'Romero, Beatriz', dni: '25.780.440' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 14px',
        fontSize: 11,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        color: '#7B8799',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E2D8',
        borderRadius: 12,
        padding: 22,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function NuevoCasoPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<typeof MOCK_CLIENTES[0] | null>(null);
  const [area, setArea] = useState<AreaDerecho | null>(null);
  const [tipoReclamo, setTipoReclamo] = useState<TipoReclamoArt | null>(null);
  const [abogadoId, setAbogadoId] = useState<number>(MOCK_ABOGADOS[0].id);
  const [expediente, setExpediente] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setSearchQuery(v);
    setShowResults(v.trim().length > 0);
    setClienteSeleccionado(null);
  }

  const resultados = MOCK_CLIENTES.filter(
    (c) =>
      c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dni.includes(searchQuery),
  );

  const abogadoLabel = MOCK_ABOGADOS.find((a) => a.id === abogadoId)?.label ?? '—';
  const canCreate =
    clienteSeleccionado !== null &&
    area !== null &&
    (area !== 'ART' || tipoReclamo !== null);

  async function handleCrear() {
    if (!clienteSeleccionado || !area) return;
    setLoading(true);
    setError(null);
    try {
      const nuevo = await casosApi.crear({
        cliente_id: clienteSeleccionado.id,
        abogado_responsable_id: abogadoId,
        area,
        tipo_reclamo: area === 'ART' ? tipoReclamo : null,
        codigo_expediente: expediente.trim() || null,
        observaciones: observaciones.trim() || null,
      });
      const ruta = area === 'LABORAL' ? `/casos/${nuevo.id}/laboral` : `/casos/${nuevo.id}/art`;
      navigate(ruta);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('422')) {
        setError('Datos inválidos. Revisá que todos los campos obligatorios estén completos.');
      } else if (msg.includes('404')) {
        setError('El cliente o el abogado seleccionado no existe.');
      } else {
        setError('No se pudo crear el caso. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        fontFamily: 'Inter, sans-serif',
        color: '#131C2E',
        padding: '28px 32px',
        background: '#F2F0EA',
        minHeight: '100vh',
      }}
    >
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/casos')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#5A6478',
          fontSize: 13,
          fontWeight: 500,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ← Casos / <span style={{ color: '#131C2E', fontWeight: 600 }}>Nuevo caso</span>
      </button>

      {/* Two-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 20,
          marginTop: 24,
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card A: Búsqueda de cliente */}
          <Card>
            <SectionLabel>1. Cliente</SectionLabel>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Buscar por nombre o DNI..."
                style={{
                  width: '100%',
                  height: 40,
                  border: '1.5px solid #E5E2D8',
                  borderRadius: 8,
                  background: '#FAFAF7',
                  paddingLeft: 12,
                  paddingRight: 12,
                  fontSize: 13,
                  color: '#131C2E',
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {showResults && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {resultados.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9BA8B8', margin: 0 }}>
                    No se encontraron clientes.
                  </p>
                ) : (
                  resultados.map((cli) => (
                    <div
                      key={cli.id}
                      onClick={() => {
                        setClienteSeleccionado(cli);
                        setShowResults(false);
                        setSearchQuery(cli.nombre);
                      }}
                      style={{
                        background: clienteSeleccionado?.id === cli.id ? '#EEF2FA' : '#F7F6F1',
                        border:
                          clienteSeleccionado?.id === cli.id
                            ? '1.5px solid #1B3A6B'
                            : '1px solid #E5E2D8',
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#131C2E' }}>
                          {cli.nombre}
                        </p>
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7B8799' }}>
                          DNI: {cli.dni}
                        </p>
                      </div>
                      {clienteSeleccionado?.id === cli.id && (
                        <span
                          style={{
                            background: '#E6F4EE',
                            color: '#1A7A4A',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Seleccionado
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>

          {/* Card B: Área del caso */}
          <Card>
            <SectionLabel>2. Área del caso</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div
                onClick={() => { setArea('LABORAL'); setTipoReclamo(null); }}
                style={{
                  border: area === 'LABORAL' ? '2px solid #1B3A6B' : '1.5px solid #E5E2D8',
                  background: area === 'LABORAL' ? '#EEF2FA' : '#F7F6F1',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>⚖</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: area === 'LABORAL' ? '#1B3A6B' : '#131C2E' }}>
                    Laboral
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#7B8799' }}>Derecho del trabajo</p>
              </div>

              <div
                onClick={() => setArea('ART')}
                style={{
                  border: area === 'ART' ? '2px solid #0B7285' : '1.5px solid #E5E2D8',
                  background: area === 'ART' ? '#E3F5F5' : '#F7F6F1',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>+</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: area === 'ART' ? '#0B7285' : '#131C2E' }}>
                    ART
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#7B8799' }}>Aseguradora de riesgos del trabajo</p>
              </div>
            </div>

            {/* Tipo de reclamo — solo para ART */}
            {area === 'ART' && (
              <div style={{ marginTop: 14 }}>
                <SectionLabel>Tipo de reclamo (obligatorio para ART)</SectionLabel>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['ACCIDENTE', 'ENFERMEDAD'] as TipoReclamoArt[]).map((tipo) => (
                    <button
                      key={tipo}
                      onClick={() => setTipoReclamo(tipo)}
                      style={{
                        border: tipoReclamo === tipo ? '2px solid #0B7285' : '1.5px solid #E5E2D8',
                        background: tipoReclamo === tipo ? '#E3F5F5' : '#F7F6F1',
                        borderRadius: 8,
                        padding: '8px 18px',
                        fontSize: 13,
                        fontWeight: tipoReclamo === tipo ? 700 : 500,
                        color: tipoReclamo === tipo ? '#0B7285' : '#5A6478',
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {tipo === 'ACCIDENTE' ? 'Accidente' : 'Enfermedad profesional'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Card C: Abogado responsable */}
          <Card>
            <SectionLabel>3. Abogado</SectionLabel>
            <select
              value={abogadoId}
              onChange={(e) => setAbogadoId(Number(e.target.value))}
              style={{
                width: '100%',
                height: 44,
                border: '1.5px solid #E5E2D8',
                borderRadius: 8,
                background: '#FAFAF7',
                fontSize: 13,
                padding: '0 12px',
                color: '#131C2E',
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {MOCK_ABOGADOS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Card>

          {/* Card D: Datos adicionales (opcionales) */}
          <Card>
            <SectionLabel>4. Datos adicionales (opcional)</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8799', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Código de expediente
                </label>
                <input
                  type="text"
                  value={expediente}
                  onChange={(e) => setExpediente(e.target.value)}
                  placeholder="Ej: EXP-2026-000100"
                  style={{
                    width: '100%',
                    height: 40,
                    border: '1.5px solid #E5E2D8',
                    borderRadius: 8,
                    background: '#FAFAF7',
                    padding: '0 12px',
                    fontSize: 13,
                    color: '#131C2E',
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8799', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas internas del caso..."
                  rows={3}
                  style={{
                    width: '100%',
                    border: '1.5px solid #E5E2D8',
                    borderRadius: 8,
                    background: '#FAFAF7',
                    padding: '8px 12px',
                    fontSize: 13,
                    color: '#131C2E',
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN — Resumen */}
        <Card style={{ position: 'sticky', top: 20 }}>
          <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#131C2E', fontFamily: 'Inter, sans-serif' }}>
            Resumen
          </p>

          {[
            { label: 'Cliente', value: clienteSeleccionado?.nombre ?? '—' },
            { label: 'Área', value: area === 'LABORAL' ? 'Laboral' : area === 'ART' ? 'ART' : '—' },
            {
              label: 'Tipo de reclamo',
              value:
                area === 'ART'
                  ? tipoReclamo === 'ACCIDENTE'
                    ? 'Accidente'
                    : tipoReclamo === 'ENFERMEDAD'
                    ? 'Enfermedad profesional'
                    : '—'
                  : 'N/A',
            },
            { label: 'Abogado', value: abogadoLabel },
            { label: 'Expediente', value: expediente || '—' },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                borderBottom: '1px solid #F2F0EA',
                padding: '10px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, color: '#7B8799', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
                {row.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: row.value === '—' ? '#9BA8B8' : '#131C2E' }}>
                {row.value}
              </span>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '8px 12px',
                marginTop: 12,
                fontSize: 12,
                color: '#991B1B',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={() => void handleCrear()}
            disabled={!canCreate || loading}
            style={{
              width: '100%',
              height: 44,
              marginTop: 16,
              background: '#1B3A6B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              cursor: canCreate && !loading ? 'pointer' : 'not-allowed',
              opacity: canCreate && !loading ? 1 : 0.5,
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Creando caso…' : 'Crear caso'}
          </button>

          <button
            onClick={() => navigate('/casos')}
            style={{
              width: '100%',
              height: 40,
              marginTop: 8,
              background: '#F2F0EA',
              color: '#5A6478',
              border: '1px solid #D8D4CA',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </Card>
      </div>
    </div>
  );
}
