/**
 * EditorBorrador — Muestra y permite editar el borrador generado por IA (RF-17).
 *
 * Comportamiento:
 *   - Botón "Generar actualización" dispara el POST y muestra spinner.
 *   - Con borrador exitoso: textarea editable + badge PENDIENTE_REVISION +
 *     mensaje explícito "El envío al cliente es manual — no se envía solo" (RF-18, RN-10).
 *   - Con 503 (IA no disponible): aviso + textarea vacío para redacción manual.
 *   - Botón "Copiar" para copiar el texto al portapapeles.
 */
import React, { useState } from 'react';
import { useGenerarActualizacion } from '../hooks/useGenerarActualizacion';

interface EditorBorradorProps {
  casoId: number;
}

export function EditorBorrador({ casoId }: EditorBorradorProps) {
  const { loading, error, iaNoDisponible, actualizacion, generar } =
    useGenerarActualizacion(casoId);
  const [texto, setTexto] = useState('');
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (actualizacion) setTexto(actualizacion.borrador);
  }, [actualizacion]);

  function handleCopiar() {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const mostrarEditor = actualizacion !== null || iaNoDisponible;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Botón de generar */}
      {!mostrarEditor && (
        <button
          onClick={generar}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: loading ? '#E5E2D8' : '#C9A028',
            color: loading ? '#7B8799' : '#fff',
            border: 'none', borderRadius: 8,
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #9BA8B8', borderTopColor: '#1B3A6B', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Generando…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              Generar actualización
            </>
          )}
        </button>
      )}

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Error genérico */}
      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#991B1B' }}>
          {error}
        </div>
      )}

      {/* Aviso 503 — IA no disponible */}
      {iaNoDisponible && (
        <div style={{ background: '#FFF9EC', border: '1px solid #F5D99A', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#B45309', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#B45309" />
          </svg>
          <span>El servicio de IA no está disponible. Podés redactar el mensaje manualmente.</span>
        </div>
      )}

      {/* Editor del borrador */}
      {mostrarEditor && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Badge PENDIENTE_REVISION */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: '#FEF3E2', color: '#B45309',
              borderRadius: 4, padding: '2px 8px',
              fontSize: 11, fontWeight: 700, letterSpacing: '.4px',
            }}>
              PENDIENTE_REVISION
            </span>
            {actualizacion && (
              <span style={{ fontSize: 11, color: '#9BA8B8' }}>
                Generado {new Date(actualizacion.generado_en).toLocaleString('es-AR')}
              </span>
            )}
          </div>

          {/* Aviso obligatorio RN-10 / RF-18 */}
          <div style={{ background: '#FFF9EC', border: '1px solid #F5D99A', borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#92400E', fontWeight: 500 }}>
            El envío al cliente es manual — no se envía solo.
          </div>

          {/* Textarea editable */}
          <label style={{ fontSize: 11, fontWeight: 600, color: '#7B8799', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Borrador del mensaje
          </label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={iaNoDisponible ? 'Redactá el mensaje manualmente…' : ''}
            style={{
              width: '100%', minHeight: 140, resize: 'vertical',
              border: '1.5px solid #E5E2D8', borderRadius: 8,
              background: '#FAFAF7', padding: 12,
              fontFamily: 'Inter, sans-serif', fontSize: 13,
              color: '#131C2E', lineHeight: 1.6, outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopiar}
              disabled={!texto}
              style={{
                background: '#F2F0EA', color: '#5A6478',
                border: '1px solid #D8D4CA', borderRadius: 8,
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                cursor: texto ? 'pointer' : 'not-allowed', opacity: texto ? 1 : 0.5,
              }}
            >
              {copied ? '¡Copiado!' : 'Copiar texto'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
