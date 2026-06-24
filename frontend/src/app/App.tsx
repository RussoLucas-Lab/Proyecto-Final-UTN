import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AppShell from './AppShell';

const LoginPage         = lazy(() => import('../features/auth/LoginPage'));
const DashboardPage     = lazy(() => import('../features/dashboard/DashboardPage'));
const CasosPage         = lazy(() => import('../features/casos/CasosPage'));
const NuevoCasoPage     = lazy(() => import('../features/casos/NuevoCasoPage'));
const CasoLaboralPage   = lazy(() => import('../features/casos/CasoLaboralPage'));
const CasoARTPage       = lazy(() => import('../features/casos/CasoARTPage'));
const ClientesPage      = lazy(() => import('../features/clientes/ClientesPage'));
const NuevoClientePage  = lazy(() => import('../features/clientes/NuevoClientePage'));
const BatchPage         = lazy(() => import('../features/comunicaciones/BatchPage'));
const TelegramaPage     = lazy(() => import('../features/telegramas/TelegramaPage'));
const AgendaPage        = lazy(() => import('../features/agenda/AgendaPage'));
const UsuariosPage      = lazy(() => import('../features/usuarios/UsuariosPage'));
const RespaldosPage     = lazy(() => import('../features/respaldos/RespaldosPage'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireSocio({ children }: { children: React.ReactNode }) {
  const { isSocio } = useAuth();
  return isSocio ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <div style={{ width: 32, height: 32, border: '3px solid #E5E2D8', borderTopColor: '#1B3A6B', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"       element={<DashboardPage />} />
          <Route path="casos"           element={<CasosPage />} />
          <Route path="casos/nuevo"     element={<NuevoCasoPage />} />
          <Route path="casos/:id/laboral" element={<CasoLaboralPage />} />
          <Route path="casos/:id/art"   element={<CasoARTPage />} />
          <Route path="clientes"        element={<ClientesPage />} />
          <Route path="clientes/nuevo"  element={<NuevoClientePage />} />
          <Route path="actualizaciones" element={<BatchPage />} />
          <Route path="telegrama/:casoId" element={<TelegramaPage />} />
          <Route path="agenda"          element={<AgendaPage />} />
          <Route path="usuarios"        element={<RequireSocio><UsuariosPage /></RequireSocio>} />
          <Route path="respaldos"       element={<RequireSocio><RespaldosPage /></RequireSocio>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
