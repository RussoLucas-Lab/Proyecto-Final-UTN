import React, { useState } from 'react';
import { getDownloadUrl } from '../api';
import type { DocumentoResponse } from '../types';

const FORMATO_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  PDF:    { bg: '#FEE4E2', color: '#C9423A', label: 'PDF' },
  DOC:    { bg: '#DBEAFE', color: '#1D4ED8', label: 'DOC' },
  IMAGEN: { bg: '#D1FAE5', color: '#065F46', label: 'IMG' },
};

function formatFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface Props {
  documentos: DocumentoResponse[];
}

export function DocumentList({ documentos }: Props) {
  const [downloading, setDownloading] = useState<number | null>(null);

  if (documentos.length === 0) {
    return (
      <div style={{ fontSize: 13, color: '#8B95A5', textAlign: 'center', padding: '12px 0' }}>
        Sin documentos adjuntos
      </div>
    );
  }

  const handleDescargar = async (doc: DocumentoResponse) => {
    setDownloading(doc.id);
    try {
      const { download_url } = await getDownloadUrl(doc.id);
      window.open(download_url, '_blank', 'noopener,noreferrer');
    } catch {
      alert('No se pudo obtener el enlace de descarga. Intentá de nuevo.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {documentos.map((doc) => {
        const fmt = FORMATO_COLOR[doc.formato] ?? { bg: '#F2F0EA', color: '#6B7280', label: doc.formato };
        return (
          <div
            key={doc.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: '#F7F6F1',
              borderRadius: 8, border: '1px solid #E9E6DE',
            }}
          >
            {/* Ícono formato */}
            <div style={{
              width: 32, height: 32, background: fmt.bg, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: fmt.color }}>{fmt.label}</span>
            </div>

            {/* Nombre y fecha */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#131C2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.nombre_archivo}
              </div>
              <div style={{ fontSize: 11, color: '#8B95A5', marginTop: 1 }}>
                {doc.categoria.replace(/_/g, ' ')} · {formatFecha(doc.subido_en)}
              </div>
            </div>

            {/* Botón descargar */}
            <button
              onClick={() => handleDescargar(doc)}
              disabled={downloading === doc.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: '1px solid #D8D4CA',
                borderRadius: 6, padding: '5px 10px', fontSize: 12,
                color: '#1B3A6B', cursor: downloading === doc.id ? 'not-allowed' : 'pointer',
                fontWeight: 500, opacity: downloading === doc.id ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading === doc.id ? 'Abriendo…' : 'Descargar'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
