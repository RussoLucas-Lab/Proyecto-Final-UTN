/**
 * Hook de datos para la feature respaldos.
 * Llama a listarRespaldos() y expone respaldos, loading, error y refresh.
 */

import { useCallback, useEffect, useState } from 'react';
import { listarRespaldos } from '../api';
import type { Respaldo } from '../types';

interface UseRespaldosResult {
  respaldos: Respaldo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRespaldos(): UseRespaldosResult {
  const [respaldos, setRespaldos] = useState<Respaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRespaldos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listarRespaldos();
      setRespaldos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los respaldos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRespaldos();
  }, [fetchRespaldos]);

  return { respaldos, loading, error, refresh: fetchRespaldos };
}
