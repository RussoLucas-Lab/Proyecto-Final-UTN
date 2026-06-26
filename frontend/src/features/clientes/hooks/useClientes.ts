/**
 * Hook para cargar, buscar y mutar la lista de clientes del estudio.
 *
 * Gestiona estado local (lista, carga, error) y expone helpers
 * para búsqueda paginada, alta y edición.
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api';
import type { Cliente, ClienteCreate, ClienteUpdate } from '../types';

interface UseClientesState {
  clientes: Cliente[];
  isLoading: boolean;
  error: string | null;
}

interface UseClientesActions {
  recargar: (params?: { search?: string; page?: number }) => Promise<void>;
  crear: (datos: ClienteCreate) => Promise<Cliente>;
  editar: (id: number, datos: ClienteUpdate) => Promise<Cliente>;
}

export function useClientes(
  initialParams?: { search?: string; page?: number },
): UseClientesState & UseClientesActions {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async (params?: { search?: string; page?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const lista = await api.listar(params ?? initialParams);
      setClientes(lista);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void recargar(initialParams);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargar]);

  const crear = useCallback(async (datos: ClienteCreate): Promise<Cliente> => {
    const nuevo = await api.crear(datos);
    setClientes((prev) => [nuevo, ...prev]);
    return nuevo;
  }, []);

  const editar = useCallback(async (id: number, datos: ClienteUpdate): Promise<Cliente> => {
    const actualizado = await api.editar(id, datos);
    setClientes((prev) => prev.map((c) => (c.id === id ? actualizado : c)));
    return actualizado;
  }, []);

  return { clientes, isLoading, error, recargar, crear, editar };
}
