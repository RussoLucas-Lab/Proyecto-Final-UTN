import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { to: '/casos',     label: 'Casos',     icon: <IconCasos /> },
  { to: '/clientes',  label: 'Clientes',  icon: <IconClientes /> },
  { to: '/agenda',    label: 'Agenda',    icon: <IconAgenda /> },
];

const ADMIN_ITEMS = [
  { to: '/usuarios',  label: 'Usuarios',  icon: <IconUsuarios /> },
  { to: '/respaldos', label: 'Respaldos', icon: <IconRespaldos /> },
];

export default function AppShell() {
  const { user, logout, isSocio } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = user?.iniciales ?? '?';
  const nombre = user?.nombre ?? '';
  const rol = user?.rol === 'SOCIO' ? 'Socio' : 'Abogado';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <nav style={{
        width: 240, flexShrink: 0, background: '#0C1E3E',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '28px 24px 0' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
            Iuris
          </div>
          <div style={{ height: 3, background: '#C9A028', borderRadius: 2, marginTop: 6, width: 36 }} />
        </div>

        {/* Nav items */}
        <div style={{ marginTop: 32, flex: 1 }}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} />
          ))}

          {isSocio && (
            <>
              <div style={{ margin: '20px 20px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                Administración
              </div>
              {ADMIN_ITEMS.map(({ to, label, icon }) => (
                <NavItem key={to} to={to} label={label} icon={icon} />
              ))}
            </>
          )}
        </div>

        {/* User footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(201,160,40,0.2)', border: '1.5px solid rgba(201,160,40,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#C9A028', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{rol}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              style={{ background: 'none', border: 'none', padding: 4, color: 'rgba(255,255,255,0.35)', cursor: 'pointer', borderRadius: 4, flexShrink: 0 }}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Right column: topbar + content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 58, flexShrink: 0, background: '#FFFFFF',
          borderBottom: '1px solid #E9E6DE',
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px',
        }}>
          <div style={{ flex: 1, maxWidth: 360 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FAFAF7', border: '1.5px solid #E5E2D8', borderRadius: 8, padding: '0 12px', height: 36 }}>
              <IconSearch />
              <input
                type="search"
                placeholder="Buscar casos, clientes..."
                style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13, color: '#131C2E' }}
              />
            </div>
          </div>

          <button
            onClick={() => setNotifOpen((v) => !v)}
            style={{ position: 'relative', background: 'none', border: 'none', padding: 6, borderRadius: 8, color: '#7B8799', cursor: 'pointer' }}
          >
            <IconBell />
            <span style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: '#C9423A', border: '1.5px solid #FFFFFF' }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#E8EDF8', border: '1.5px solid #C5D0E8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#1B3A6B',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#131C2E' }}>{nombre}</div>
              <div style={{ fontSize: 11, color: '#7B8799' }}>{rol}</div>
            </div>
            <IconChevron />
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#F2F0EA', padding: '28px 32px' }}>
          <div className="ani">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', margin: '1px 8px', borderRadius: 8,
        fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s',
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.62)',
        background: isActive ? 'rgba(201,160,40,0.14)' : 'transparent',
        borderLeft: `3px solid ${isActive ? '#C9A028' : 'transparent'}`,
      })}
    >
      {icon}
      {label}
    </NavLink>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function IconCasos() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  );
}
function IconClientes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconAgenda() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconUsuarios() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconRespaldos() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 7 20 17 4 17 4 7" />
      <polyline points="1 7 23 7" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9BA8B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9BA8B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,9 12,15 18,9" />
    </svg>
  );
}
