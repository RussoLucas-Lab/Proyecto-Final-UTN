import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Rol } from '../shared/types';
import { login as apiLogin, logout as apiLogout, refresh as apiRefresh } from '../features/auth/api';

export interface AuthUser {
  nombre: string;
  rol: Rol;
  iniciales: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isSocio: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

function deriveIniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On mount: attempt silent refresh to restore session from HttpOnly cookie.
    // If refresh token is absent or expired, silently stay logged out.
    apiRefresh()
      .then((perfil) => setUser({ ...perfil, iniciales: deriveIniciales(perfil.nombre) }))
      .catch(() => { /* no refresh cookie → stay logged out */ })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const perfil = await apiLogin(email, password);
    setUser({ ...perfil, iniciales: deriveIniciales(perfil.nombre) });
  }

  function logout() {
    setUser(null);
    void apiLogout();
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isSocio: user?.rol === 'SOCIO', isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
