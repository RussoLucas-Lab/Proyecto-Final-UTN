import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [linkHovered, setLinkHovered] = useState(false);

  const handleLogin = () => {
    login({ id: 1, nombre: 'Dr. Martín Suárez', rol: 'SOCIO', iniciales: 'MS' });
    navigate('/dashboard');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'linear-gradient(148deg, #070F1F 0%, #122242 55%, #0B1A35 100%)',
        backgroundImage: [
          'linear-gradient(148deg, #070F1F 0%, #122242 55%, #0B1A35 100%)',
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M60 0L0 0 0 60' fill='none' stroke='rgba(201,160,40,0.05)' stroke-width='1'/%3E%3C/svg%3E\")",
        ].join(', '),
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Card */}
      <div
        style={{
          width: 420,
          padding: '52px 48px',
          borderRadius: 16,
          background: '#FFFFFF',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          animation: 'mIn 0.4s ease',
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: 46,
            color: '#131C2E',
            lineHeight: 1,
          }}
        >
          Iuris
        </div>

        {/* Gold divider */}
        <div
          style={{
            height: 3,
            width: 48,
            background: '#C9A028',
            margin: '12px 0 16px',
            borderRadius: 2,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            color: '#7B8799',
          }}
        >
          Estudio Jurídico · Mendoza
        </div>

        {/* Spacer */}
        <div style={{ height: 32 }} />

        {/* Email label */}
        <label
          style={{
            display: 'block',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 11,
            color: '#5A6478',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Correo Electrónico
        </label>

        {/* Email input */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          style={{
            width: '100%',
            height: 44,
            border: emailFocused ? '1.5px solid #1B3A6B' : '1.5px solid #E5E2D8',
            borderRadius: 8,
            background: '#FAFAF7',
            padding: '0 14px',
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            color: '#131C2E',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease',
          }}
        />

        {/* Spacer */}
        <div style={{ height: 16 }} />

        {/* Password label */}
        <label
          style={{
            display: 'block',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 11,
            color: '#5A6478',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Contraseña
        </label>

        {/* Password input */}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          style={{
            width: '100%',
            height: 44,
            border: passwordFocused ? '1.5px solid #1B3A6B' : '1.5px solid #E5E2D8',
            borderRadius: 8,
            background: '#FAFAF7',
            padding: '0 14px',
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            color: '#131C2E',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease',
          }}
        />

        {/* Forgot password link */}
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          onMouseEnter={() => setLinkHovered(true)}
          onMouseLeave={() => setLinkHovered(false)}
          style={{
            display: 'block',
            fontSize: 12,
            color: linkHovered ? '#1B3A6B' : '#7B8799',
            textAlign: 'right',
            marginTop: 8,
            textDecoration: 'none',
            transition: 'color 0.15s ease',
          }}
        >
          ¿Olvidó su contraseña?
        </a>

        {/* Spacer */}
        <div style={{ height: 28 }} />

        {/* Login button */}
        <button
          onClick={handleLogin}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            width: '100%',
            height: 46,
            background: btnHovered ? '#162F59' : '#1B3A6B',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          Ingresar
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.3px',
        }}
      >
        IURIS · Estudio Jurídico · Mendoza, Argentina
      </div>
    </div>
  );
}
