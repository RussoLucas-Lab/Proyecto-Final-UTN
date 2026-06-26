/**
 * Hook para cargar el detalle de un caso y mutar su estado de etapa.
 *
 * Carga el caso + historial. Expone helpers para avanzar/retroceder etapa.
 * Los errores 409 (transición inválida / retroceso sin confirmar) se propagan
 * para que el componente los maneje con mensajes en español (AR).
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api';
import type { CasoDetalle, HistorialItem } from '../types';

interface UseCasoState {
  caso: CasoDetalle | null;
  historial: HistorialItem[];
  isLoading: boolean;
  error: string | null;
}

interface UseCasoActions {
  recargar: () => Promise<void>;
  avanzar: (etapaDestinoId: number) => Promise<void>;
  retroceder: (etapaDestinoId: number, confirmar?: boolean) => Promise<void>;
  upsertFicha: (datos: Parameters<typeof api.upsertFicha>[1]) => Promise<void>;
}

export function useCaso(id: number | undefined): UseCasoState & UseCasoActions {
  const [caso, setCaso] = useState<CasoDetalle | null>(null);
  const [historialItems, setHistorialItems] = useState<HistorialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (id === undefined) return;
    setIsLoading(true);
    setError(null);
    try {
      const [detalle, hist] = await Promise.all([
        api.obtener(id),
        api.historial(id),
      ]);
      setCaso(detalle);
      setHistorialItems(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el caso');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const avanzar = useCallback(
    async (etapaDestinoId: number) => {
      if (!id) return;
      // Lanza si 409 (TransicionInvalida) — el componente lo captura
      await api.avanzar(id, etapaDestinoId);
      await recargar();
    },
    [id, recargar],
  );

  const retroceder = useCallback(
    async (etapaDestinoId: number, confirmar = false) => {
      if (!id) return;
      // Lanza si 409 (RetrocesoSinConfirmar o área inválida) — el componente lo captura
      await api.retroceder(id, etapaDestinoId, confirmar);
      await recargar();
    },
    [id, recargar],
  );

  const upsertFicha = useCallback(
    async (datos: Parameters<typeof api.upsertFicha>[1]) => {
      if (!id) return;
      await api.upsertFicha(id, datos);
      await recargar();
    },
    [id, recargar],
  );

  return {
    caso,
    historial: historialItems,
    isLoading,
    error,
    recargar,
    avanzar,
    retroceder,
    upsertFicha,
  };
}
