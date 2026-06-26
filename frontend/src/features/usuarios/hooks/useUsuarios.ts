/**
 * Hook para cargar y mutar la lista de usuarios del estudio.
 *
 * Gestiona estado local (lista, carga, error) y expone helpers
 * para alta, edición y toggle de activación.
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api';
import type { Usuario, UsuarioActivacion, UsuarioCreate, UsuarioUpdate } from '../types';

interface UseUsuariosState {
  usuarios: Usuario[];
  isLoading: boolean;
  error: string | null;
}

interface UseUsuariosActions {
  recargar: () => Promise<void>;
  crear: (datos: UsuarioCreate) => Promise<Usuario>;
  editar: (id: number, datos: UsuarioUpdate) => Promise<Usuario>;
  cambiarActivacion: (id: number, datos: UsuarioActivacion) => Promise<Usuario>;
}

export function useUsuarios(): UseUsuariosState & UseUsuariosActions {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const lista = await api.listar();
      setUsuarios(lista);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const crear = useCallback(async (datos: UsuarioCreate): Promise<Usuario> => {
    const nuevo = await api.crear(datos);
    setUsuarios((prev) => [...prev, nuevo]);
    return nuevo;
  }, []);

  const editar = useCallback(async (id: number, datos: UsuarioUpdate): Promise<Usuario> => {
    const actualizado = await api.editar(id, datos);
    setUsuarios((prev) => prev.map((u) => (u.id === id ? actualizado : u)));
    return actualizado;
  }, []);

  const cambiarActivacion = useCallback(
    async (id: number, datos: UsuarioActivacion): Promise<Usuario> => {
      const actualizado = await api.cambiarActivacion(id, datos);
      setUsuarios((prev) => prev.map((u) => (u.id === id ? actualizado : u)));
      return actualizado;
    },
    [],
  );

  return { usuarios, isLoading, error, recargar, crear, editar, cambiarActivacion };
}
