import React, { useState } from 'react';

export function IAModal({ onClose }: { onClose: () => void }) {
  const DEFAULT_DRAFT =
    'Estimado Sr. González, le informamos que su caso ha avanzado satisfactoriamente a la etapa de Telegrama Obrero. En los próximos días nos pondremos en contacto para coordinar los pasos a seguir. Ante cualquier consulta no dude en comunicarse con el estudio. Saludos cordiales, Estudio Jurídico Iuris.';

  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          width: 560,
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          animation: 'mIn 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E9E6DE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                background: '#FEF3E2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"
                  fill="#C9A028"
                />
              </svg>
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#131C2E' }}>
              Generar actualización con IA
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#7B8799',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Notice banner */}
        <div
          style={{
            margin: '16px 24px 0',
            background: '#FFF9EC',
            border: '1px solid #F5D99A',
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill="#B45309"
            />
          </svg>
          <p style={{ margin: 0, fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#B45309', lineHeight: 1.5 }}>
            La IA genera un borrador. El abogado revisa y aprueba antes de enviar por WhatsApp. Nada se envía automáticamente.
          </p>
        </div>

        {/* Draft textarea */}
        <div style={{ padding: '16px 24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              color: '#7B8799',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 8,
            }}
          >
            Borrador del mensaje
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              width: 'calc(100% - 28px)',
              minHeight: 160,
              resize: 'vertical',
              border: '1.5px solid #E5E2D8',
              borderRadius: 8,
              background: '#FAFAF7',
              padding: 14,
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              color: '#131C2E',
              lineHeight: 1.6,
              outline: 'none',
            }}
          />
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9BA8B8', fontFamily: 'Inter, sans-serif' }}>
            Podés editar el texto antes de aprobar.
          </p>
        </div>

        {/* Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E9E6DE',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: '#F2F0EA',
              color: '#C9423A',
              border: '1px solid #D8D4CA',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCopy}
            style={{
              background: '#F2F0EA',
              color: '#5A6478',
              border: '1px solid #D8D4CA',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copied ? '¡Copiado!' : 'Copiar texto'}
          </button>
          <button
            style={{
              background: '#1A7A4A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}
