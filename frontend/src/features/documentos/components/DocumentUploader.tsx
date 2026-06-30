import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { getDownloadUrl, initUpload, listDocumentos, registerDocumento, uploadToStorage } from '../api';
import type { CategoriaDocumento, DocumentoResponse, FormatoDocumento } from '../types';

const CATEGORIAS: { value: CategoriaDocumento; label: string }[] = [
  { value: 'DNI', label: 'DNI' },
  { value: 'BONO_SUELDO', label: 'Bono de sueldo' },
  { value: 'HISTORIA_CLINICA', label: 'Historia clínica' },
  { value: 'ACTA_NOTARIAL', label: 'Acta notarial' },
  { value: 'PODER', label: 'Poder' },
  { value: 'OTRO', label: 'Otro' },
];

function inferFormato(file: File): FormatoDocumento {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'doc' || ext === 'docx') return 'DOC';
  return 'IMAGEN';
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface Props {
  casoId: number;
  onUploaded: (doc: DocumentoResponse) => void;
}

export function DocumentUploader({ casoId, onUploaded }: Props) {
  const [categoria, setCategoria] = useState<CategoriaDocumento>('OTRO');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadState('uploading');
    setError(null);

    try {
      const formato = inferFormato(file);
      const init = await initUpload(casoId, {
        nombre_archivo: file.name,
        categoria,
        formato,
      });

      await uploadToStorage(init.upload_url, file);

      const doc = await registerDocumento(casoId, {
        object_key: init.object_key,
        nombre_archivo: file.name,
        categoria,
        formato,
      });

      setUploadState('success');
      onUploaded(doc);
      setTimeout(() => setUploadState('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo');
      setUploadState('error');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
  });

  const isUploading = uploadState === 'uploading';

  return (
    <div>
      {/* Selector de categoría */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
          Categoría
        </label>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}
          disabled={isUploading}
          style={{
            fontSize: 13, color: '#131C2E', background: '#F7F6F1',
            border: '1px solid #E5E2D8', borderRadius: 6, padding: '6px 10px',
            width: '100%', outline: 'none',
          }}
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Zona drag & drop */}
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? '#1B3A6B' : '#D8D4CA'}`,
          borderRadius: 10,
          padding: 20,
          textAlign: 'center',
          background: isDragActive ? '#EEF2F9' : '#FAFAF7',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          opacity: isUploading ? 0.7 : 1,
        }}
      >
        <input {...getInputProps()} disabled={isUploading} />
        {uploadState === 'uploading' ? (
          <div style={{ fontSize: 13, color: '#1B3A6B' }}>Subiendo…</div>
        ) : uploadState === 'success' ? (
          <div style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>✓ Archivo subido</div>
        ) : (
          <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isDragActive ? '#1B3A6B' : '#C0BAB0'} strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block' }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div style={{ fontSize: 13, color: isDragActive ? '#1B3A6B' : '#8B95A5' }}>
              {isDragActive ? 'Soltá el archivo aquí' : 'Arrastre un archivo o haga clic para seleccionar'}
            </div>
            <div style={{ fontSize: 11, color: '#B0A89C', marginTop: 4 }}>
              PDF, DOC, DOCX, JPG, PNG — Solo el abogado puede subir documentos
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#991B1B' }}>{error}</div>
      )}
    </div>
  );
}
