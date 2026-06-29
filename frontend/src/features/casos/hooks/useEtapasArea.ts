import { useEffect, useState } from 'react';
import * as api from '../api';
import type { AreaDerecho, Etapa } from '../types';

export function useEtapasArea(area: AreaDerecho) {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api
      .listarEtapas(area)
      .then(setEtapas)
      .finally(() => setIsLoading(false));
  }, [area]);

  return { etapas, isLoading };
}
