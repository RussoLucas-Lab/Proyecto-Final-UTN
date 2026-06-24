import { useNavigate } from 'react-router-dom';

// ── helpers ────────────────────────────────────────────────────────────────

function formatDate(): string {
  const d = new Date(2026, 5, 24); // fixed to today per project date
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── sub-components ─────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number;
  sub: string;
  subColor: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

function MetricCard({ label, value, sub, subColor, iconBg, iconColor, icon }: MetricCardProps) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E2D8',
        borderRadius: 12,
        padding: '20px 22px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* icon circle */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: iconColor,
          }}
        >
          {icon}
        </div>
        <div>
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 12,
              color: '#7B8799',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 2,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 28,
              color: '#131C2E',
              lineHeight: 1,
            }}
          >
            {value}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          fontSize: 12,
          color: subColor,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  bg: string;
  color: string;
}

function Badge({ children, bg, color }: BadgeProps) {
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 4,
        padding: '2px 7px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

interface ActionBtnProps {
  children: React.ReactNode;
  primary?: boolean;
}

function ActionBtn({ children, primary }: ActionBtnProps) {
  return (
    <button
      style={{
        background: primary ? '#1B3A6B' : '#F2F0EA',
        color: primary ? '#FFFFFF' : '#5A6478',
        border: 'none',
        borderRadius: 6,
        padding: '5px 10px',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        cursor: 'pointer',
        marginRight: primary ? 6 : 0,
      }}
    >
      {children}
    </button>
  );
}

interface VencimientoItemProps {
  day: string;
  month: string;
  name: string;
  badge: React.ReactNode;
  hoy?: boolean;
  isLast?: boolean;
}

function VencimientoItem({ day, month, name, badge, hoy, isLast }: VencimientoItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 0',
        borderBottom: isLast ? 'none' : '1px solid #F2F0EA',
      }}
    >
      {/* date column */}
      <div style={{ minWidth: 36, textAlign: 'center', flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 26,
            color: '#131C2E',
            lineHeight: 1,
          }}
        >
          {day}
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            fontSize: 10,
            color: '#7B8799',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {month}
        </div>
      </div>
      {/* content */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            color: '#131C2E',
            marginBottom: 4,
          }}
        >
          {name}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {badge}
          {hoy && (
            <Badge bg="#FEE4E2" color="#C9423A">
              HOY
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ── icons ──────────────────────────────────────────────────────────────────

const IconBriefcase = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
);

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconUserPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="16" y1="11" x2="22" y2="11" />
  </svg>
);

const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// ── avatar ─────────────────────────────────────────────────────────────────

interface AvatarProps {
  initials: string;
  bg: string;
  color: string;
}

function Avatar({ initials, bg, color }: AvatarProps) {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: bg,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        fontSize: 11,
        flexShrink: 0,
        marginRight: 8,
      }}
    >
      {initials}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();

  const dateStr =
    formatDate().charAt(0).toUpperCase() + formatDate().slice(1);

  const tableHeaderStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: 11,
    color: '#7B8799',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '9px 12px',
    background: '#FAFAF7',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px 12px',
    borderBottom: '1px solid #F2F0EA',
    verticalAlign: 'middle',
  };

  const tdLastStyle: React.CSSProperties = {
    ...tdStyle,
    borderBottom: 'none',
  };

  const rows = [
    {
      initials: 'GP',
      avatarBg: '#E8EDF8',
      avatarColor: '#1B3A6B',
      name: 'González Pérez, Carlos',
      area: 'Laboral',
      areaBg: '#E8EDF8',
      areaColor: '#1B3A6B',
      tipo: 'Telegrama 1',
      tipoBg: '#E8EDF8',
      tipoColor: '#1B3A6B',
      preview: 'Estimado Sr. González...',
    },
    {
      initials: 'MR',
      avatarBg: '#E3F5F5',
      avatarColor: '#0B7285',
      name: 'Martínez Rojas, Ana',
      area: 'ART',
      areaBg: '#E3F5F5',
      areaColor: '#0B7285',
      tipo: 'Denuncia ART',
      tipoBg: '#E3F5F5',
      tipoColor: '#0B7285',
      preview: 'La presente tiene por objeto...',
    },
    {
      initials: 'DF',
      avatarBg: '#E8EDF8',
      avatarColor: '#1B3A6B',
      name: 'Díaz Fuentes, Roberto',
      area: 'Laboral',
      areaBg: '#E8EDF8',
      areaColor: '#1B3A6B',
      tipo: 'Conciliación',
      tipoBg: '#FEF3E2',
      tipoColor: '#B45309',
      preview: 'Me dirijo a Ud. a fin de...',
    },
  ];

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: '#F2F0EA',
        minHeight: '100vh',
        padding: '32px 32px 48px',
        boxSizing: 'border-box',
      }}
    >
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              fontSize: 26,
              color: '#131C2E',
              lineHeight: 1.2,
            }}
          >
            Dashboard
          </div>
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              color: '#7B8799',
              marginTop: 4,
            }}
          >
            {dateStr}
          </div>
        </div>

        {/* Revisar actualizaciones button */}
        <button
          onClick={() => navigate('/actualizaciones')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#1B3A6B',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            padding: '9px 16px',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Revisar actualizaciones
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: '#C9A028',
              color: '#FFFFFF',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 10,
            }}
          >
            3
          </span>
        </button>
      </div>

      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 24,
        }}
      >
        <MetricCard
          label="Casos Laboral"
          value={24}
          sub="+2 este mes"
          subColor="#1A7A4A"
          iconBg="#E8EDF8"
          iconColor="#1B3A6B"
          icon={<IconBriefcase />}
        />
        <MetricCard
          label="Casos ART"
          value={11}
          sub="+1 este mes"
          subColor="#1A7A4A"
          iconBg="#E3F5F5"
          iconColor="#0B7285"
          icon={<IconShield />}
        />
        <MetricCard
          label="Clientes nuevos"
          value={5}
          sub="Últimos 30 días"
          subColor="#7B8799"
          iconBg="#FEF3E2"
          iconColor="#B45309"
          icon={<IconUserPlus />}
        />
        <MetricCard
          label="Vencimientos próximos"
          value={8}
          sub="3 esta semana"
          subColor="#C9423A"
          iconBg="#FEE4E2"
          iconColor="#C9423A"
          icon={<IconClock />}
        />
      </div>

      {/* Two-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 20,
          marginTop: 20,
        }}
      >
        {/* Left — Actualizaciones */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E2D8',
            borderRadius: 12,
            padding: 20,
          }}
        >
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 15,
                color: '#131C2E',
              }}
            >
              Actualizaciones para revisar
            </span>
            <span
              style={{
                background: '#E8EDF8',
                color: '#1B3A6B',
                borderRadius: 10,
                padding: '1px 8px',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              3
            </span>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Cliente</th>
                <th style={tableHeaderStyle}>Área</th>
                <th style={tableHeaderStyle}>Etapa</th>
                <th style={tableHeaderStyle}>Borrador</th>
                <th style={tableHeaderStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isLast = i === rows.length - 1;
                const cellStyle = isLast ? tdLastStyle : tdStyle;
                return (
                  <tr key={row.name}>
                    {/* Cliente */}
                    <td style={{ ...cellStyle, minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          initials={row.initials}
                          bg={row.avatarBg}
                          color={row.avatarColor}
                        />
                        <span
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 600,
                            fontSize: 13,
                            color: '#131C2E',
                          }}
                        >
                          {row.name}
                        </span>
                      </div>
                    </td>
                    {/* Área */}
                    <td style={cellStyle}>
                      <Badge bg={row.areaBg} color={row.areaColor}>
                        {row.area}
                      </Badge>
                    </td>
                    {/* Etapa */}
                    <td style={cellStyle}>
                      <Badge bg={row.tipoBg} color={row.tipoColor}>
                        {row.tipo}
                      </Badge>
                    </td>
                    {/* Borrador */}
                    <td
                      style={{
                        ...cellStyle,
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12,
                        color: '#7B8799',
                        maxWidth: 160,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {row.preview}
                    </td>
                    {/* Acciones */}
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <ActionBtn primary>Revisar</ActionBtn>
                      <ActionBtn>Copiar</ActionBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right — Vencimientos */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E2D8',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              color: '#131C2E',
              marginBottom: 4,
            }}
          >
            Próximos vencimientos
          </div>

          <VencimientoItem
            day="24"
            month="JUN"
            name="Conciliación SECLO - González"
            badge={<Badge bg="#E8EDF8" color="#1B3A6B">Laboral</Badge>}
            hoy
          />
          <VencimientoItem
            day="26"
            month="JUN"
            name="Vence plazo telegrama 2 - Martínez"
            badge={<Badge bg="#E3F5F5" color="#0B7285">ART</Badge>}
          />
          <VencimientoItem
            day="28"
            month="JUN"
            name="Audiencia juzgado laboral - Pérez"
            badge={<Badge bg="#E8EDF8" color="#1B3A6B">Laboral</Badge>}
          />
          <VencimientoItem
            day="3"
            month="JUL"
            name="Comisión médica - Rodríguez"
            badge={<Badge bg="#E3F5F5" color="#0B7285">ART</Badge>}
            isLast
          />
        </div>
      </div>
    </div>
  );
}
