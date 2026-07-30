export type IconType = 'gateway' | 'support' | 'admin-agent' | 'issuer' | 'finance' | 'compliance' | 'admin-mcp';

const ICON_COLOR = '#1F1B16';

function GatewayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="6" stroke={ICON_COLOR} strokeWidth="1.4"/>
      <circle cx="14" cy="14" r="2" fill={ICON_COLOR}/>
      <path d="M14 4 L14 8M14 20 L14 24M4 14 L8 14M20 14 L24 14" stroke={ICON_COLOR} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M7.5 7.5 L10.5 10.5M17.5 17.5 L20.5 20.5M7.5 20.5 L10.5 17.5M17.5 10.5 L20.5 7.5" stroke={ICON_COLOR} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Rotary phone handset */}
      <path d="M8 8 C8 8 9 6 11 7 L13 9 C13 9 14 10 13 11 L12 12 C12 12 15 16 16 16 L17 15 C18 14 19 15 19 15 L21 17 C22 18 21 20 21 20 C21 20 19 22 16 20 C13 18 8 13 8 10 C7 8 8 8 8 8Z" stroke={ICON_COLOR} strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function AdminAgentIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Document with lines being shredded */}
      <rect x="8" y="5" width="12" height="15" rx="1" stroke={ICON_COLOR} strokeWidth="1.4"/>
      <path d="M11 9 L17 9M11 12 L17 12M11 15 L15 15" stroke={ICON_COLOR} strokeWidth="1" strokeLinecap="round"/>
      {/* Shredder slots */}
      <rect x="6" y="20" width="16" height="3" rx="1" stroke={ICON_COLOR} strokeWidth="1.2"/>
      <path d="M10 20 L9 23M13 20 L13 23M16 20 L17 23" stroke={ICON_COLOR} strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function IssuerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Wax seal */}
      <circle cx="14" cy="14" r="8" stroke={ICON_COLOR} strokeWidth="1.4"/>
      <circle cx="14" cy="14" r="5" stroke={ICON_COLOR} strokeWidth="0.8" strokeDasharray="2 1.5"/>
      {/* ZK initials */}
      <path d="M11 11 L13 11 L11 17 L13 17M15 11 L17 17M15 14 L17 14" stroke={ICON_COLOR} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FinanceIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Ledger book */}
      <rect x="7" y="5" width="14" height="18" rx="1" stroke={ICON_COLOR} strokeWidth="1.4"/>
      <line x1="10" y1="5" x2="10" y2="23" stroke={ICON_COLOR} strokeWidth="1.2"/>
      <path d="M13 9 L19 9M13 12 L19 12M13 15 L19 15M13 18 L17 18" stroke={ICON_COLOR} strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function ComplianceIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Circuit/instrument panel — boxes wired left to right */}
      <rect x="4" y="11" width="5" height="6" rx="1" stroke={ICON_COLOR} strokeWidth="1.2"/>
      <rect x="11.5" y="11" width="5" height="6" rx="1" stroke={ICON_COLOR} strokeWidth="1.2"/>
      <rect x="19" y="11" width="5" height="6" rx="1" stroke={ICON_COLOR} strokeWidth="1.2"/>
      <line x1="9" y1="14" x2="11.5" y2="14" stroke={ICON_COLOR} strokeWidth="1" strokeLinecap="round"/>
      <line x1="16.5" y1="14" x2="19" y2="14" stroke={ICON_COLOR} strokeWidth="1" strokeLinecap="round"/>
      {/* Indicator lights */}
      <circle cx="6.5" cy="14" r="1" fill={ICON_COLOR} opacity="0.4"/>
      <circle cx="14" cy="14" r="1" fill={ICON_COLOR} opacity="0.4"/>
      <circle cx="21.5" cy="14" r="1" fill={ICON_COLOR} opacity="0.4"/>
      {/* Label */}
      <path d="M5 19 L8 19M12 19 L16 19M20 19 L23 19" stroke={ICON_COLOR} strokeWidth="0.8" strokeLinecap="round" opacity="0.3"/>
    </svg>
  );
}

function AdminMcpIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Filing cabinet — two drawers */}
      <rect x="7" y="5" width="14" height="18" rx="1" stroke={ICON_COLOR} strokeWidth="1.4"/>
      <line x1="7" y1="14" x2="21" y2="14" stroke={ICON_COLOR} strokeWidth="1.2"/>
      {/* Drawer handles */}
      <rect x="12" y="10" width="4" height="2" rx="1" stroke={ICON_COLOR} strokeWidth="1"/>
      <rect x="12" y="17" width="4" height="2" rx="1" stroke={ICON_COLOR} strokeWidth="1"/>
    </svg>
  );
}

export function AgentIcon({ type, size = 28 }: { type: IconType; size?: number }) {
  const scale = size / 28;
  const style = scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: 'center' } : undefined;
  const content = (() => {
    switch (type) {
      case 'gateway':    return <GatewayIcon />;
      case 'support':    return <SupportIcon />;
      case 'admin-agent': return <AdminAgentIcon />;
      case 'issuer':     return <IssuerIcon />;
      case 'finance':    return <FinanceIcon />;
      case 'compliance': return <ComplianceIcon />;
      case 'admin-mcp':  return <AdminMcpIcon />;
    }
  })();
  return <span style={style}>{content}</span>;
}
