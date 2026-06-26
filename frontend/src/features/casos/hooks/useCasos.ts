/**
 * Hook para cargar y filtrar la lista de casos.
 *
 * Gestiona estado local (lista, carga, error) y expone helpers
 * para recarga con filtros paginados.
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api';
import type { AreaDerecho, Caso } from '../types';

interface FiltrosCasos {
  area?: AreaDerecho;
  etapa_id?: number;
  abogado_id?: number;
  cliente_id?: number;
  page?: number;
}

interface UseCasosState {
  casos: Caso[];
  isLoading: boolean;
  error: string | null;
}

interface UseCasosActions {
  recargar: (filtros?: FiltrosCasos) => Promise<void>;
}

export function useCasos(initialFiltros?: FiltrosCasos): UseCasosState & UseCasosActions {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async (filtros?: FiltrosCasos) => {
    setIsLoading(true);
    setError(null);
    try {
      const lista = await api.listar(filtros ?? initialFiltros);
      setCasos(lista);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar casos');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void recargar(initialFiltros);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargar]);

  return { casos, isLoading, error, recargar };
}
