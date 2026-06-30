/**
 * Modal "Generar actualización con IA" (RF-16, RF-17, RF-18, RN-10).
 *
 * Conectado al backend real: delega la generación y edición del borrador
 * al componente EditorBorrador, que usa POST /api/v1/casos/{id}/actualizacion.
 *
 * El envío al cliente es siempre manual (RN-10).
 */
import React from 'react';
import { EditorBorrador } from './components/EditorBorrador';

interface IAModalProps {
  casoId: number;
  onClose: () => void;
}

export function IAModal({ casoId, onClose }: IAModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes mIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        style={{
          width: 580, maxHeight: '90vh', overflowY: 'auto',
          background: '#FFFFFF', borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          animation: 'mIn 0.25s ease', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #E9E6DE',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, background: '#FEF3E2', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#C9A028" />
              </svg>
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#131C2E' }}>
              Generar actualización con IA
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7B8799', fontSize: 20, lineHeight: 1, padding: 4 }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '20px 24px' }}>
          <EditorBorrador casoId={casoId} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #E9E6DE',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              background: '#F2F0EA', color: '#C9423A',
              border: '1px solid #D8D4CA', borderRadius: 8,
              padding: '9px 16px', fontSize: 13, fontFamily: 'Inter, sans-serif',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
