import React, { createContext, useContext, useState } from 'react';
import type { Rol, Area } from '../shared/types';

export interface AuthUser {
  id: number;
  nombre: string;
  rol: Rol;
  area?: Area;
  iniciales: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  isSocio: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

const MOCK_USER: AuthUser = {
  id: 1,
  nombre: 'Dr. Martín Suárez',
  rol: 'SOCIO',
  iniciales: 'MS',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(MOCK_USER);

  function login(u: AuthUser) { setUser(u); }
  function logout() { setUser(null); }

  return (
    <AuthContext.Provider value={{ user, login, logout, isSocio: user?.rol === 'SOCIO' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
