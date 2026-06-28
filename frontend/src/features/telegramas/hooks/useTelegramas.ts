import { useCallback, useEffect, useState } from 'react';
import { actualizarResultado, listarTelegramas, setResultadoTelegrama } from '../api';
import type { ResultadoTelegrama, Telegrama } from '../types';

interface UseTelegramasReturn {
  telegramas: Telegrama[];
  isLoading: boolean;
  error: string | null;
  updateResultado: (telegramaId: number, resultado: ResultadoTelegrama) => Promise<void>;
  setResultado: (numero: 1 | 2 | 3, resultado: ResultadoTelegrama) => Promise<void>;
  refetch: () => void;
}

export function useTelegramas(casoId: number | undefined): UseTelegramasReturn {
  const [telegramas, setTelegramas] = useState<Telegrama[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTelegramas = useCallback(() => {
    if (casoId === undefined) return;
    setIsLoading(true);
    setError(null);
    listarTelegramas(casoId)
      .then((data) => {
        setTelegramas(data);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Error al cargar telegramas';
        setError(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [casoId]);

  useEffect(() => {
    fetchTelegramas();
  }, [fetchTelegramas]);

  const updateResultado = useCallback(
    async (telegramaId: number, resultado: ResultadoTelegrama): Promise<void> => {
      // Actualización optimista: aplicar el cambio local antes de la respuesta
      setTelegramas((prev) =>
        prev.map((t) => (t.id === telegramaId ? { ...t, resultado } : t)),
      );
      try {
        const actualizado = await actualizarResultado(telegramaId, resultado);
        // Confirmar con el valor devuelto por el servidor
        setTelegramas((prev) =>
          prev.map((t) => (t.id === telegramaId ? actualizado : t)),
        );
      } catch (err) {
        // Revertir al estado anterior recargando desde el servidor
        fetchTelegramas();
        throw err;
      }
    },
    [fetchTelegramas],
  );

  const setResultado = useCallback(
    async (numero: 1 | 2 | 3, resultado: ResultadoTelegrama): Promise<void> => {
      if (casoId === undefined) return;
      // Optimista: actualiza o inserta en estado local
      setTelegramas((prev) => {
        const existe = prev.find((t) => t.numero === numero);
        if (existe) return prev.map((t) => (t.numero === numero ? { ...t, resultado } : t));
        return [...prev, { id: -1, caso_id: casoId, numero, resultado, tipo_comunicacion: 'OTRO', destinatario: null, domicilio_destino: null, cuerpo: null, codigo_seguimiento: null, fecha_envio: null, fecha_resultado: null }];
      });
      try {
        const actualizado = await setResultadoTelegrama(casoId, numero, resultado);
        setTelegramas((prev) =>
          prev.map((t) => (t.numero === numero ? actualizado : t)),
        );
      } catch (err) {
        fetchTelegramas();
        throw err;
      }
    },
    [casoId, fetchTelegramas],
  );

  return {
    telegramas,
    isLoading,
    error,
    updateResultado,
    setResultado,
    refetch: fetchTelegramas,
  };
}
