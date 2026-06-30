/**
 * Hook para generar el borrador de actualización de un caso (RF-16, RN-10).
 *
 * Estados:
 *   loading    → llamando al backend / esperando n8n
 *   error      → error genérico del servidor
 *   iaNoDisp   → 503: la IA no está disponible; habilita redacción manual
 *   actualizacion → borrador recibido (id, borrador, generado_en)
 */
import { useCallback, useState } from 'react';
import { generarActualizacion } from '../api';
import type { Actualizacion } from '../types';

interface UseGenerarActualizacionState {
  loading: boolean;
  error: string | null;
  iaNoDisponible: boolean;
  actualizacion: Actualizacion | null;
}

interface UseGenerarActualizacionActions {
  generar: () => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: UseGenerarActualizacionState = {
  loading: false,
  error: null,
  iaNoDisponible: false,
  actualizacion: null,
};

export function useGenerarActualizacion(
  casoId: number | undefined,
): UseGenerarActualizacionState & UseGenerarActualizacionActions {
  const [state, setState] = useState<UseGenerarActualizacionState>(INITIAL_STATE);

  const generar = useCallback(async () => {
    if (casoId === undefined) return;
    setState({ loading: true, error: null, iaNoDisponible: false, actualizacion: null });
    try {
      const result = await generarActualizacion(casoId);
      setState({ loading: false, error: null, iaNoDisponible: false, actualizacion: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is503 = msg.includes('503') || msg.toLowerCase().includes('servicio de ia');
      setState({
        loading: false,
        error: is503 ? null : msg,
        iaNoDisponible: is503,
        actualizacion: null,
      });
    }
  }, [casoId]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { ...state, generar, reset };
}
