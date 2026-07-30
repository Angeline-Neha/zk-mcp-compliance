import type { StampState } from './topology';

export interface StampProps {
  state: StampState;
  count?: number;
  max?: number;
  /** Position on the card */
  style?: React.CSSProperties;
}

export function Stamp({ state, count, max, style }: StampProps) {
  if (state === 'counting') {
    return (
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: 'rotate(-6deg)',
          ...style,
        }}
      >
        <span
          style={{
            fontFamily: "'Special Elite', serif",
            fontSize: 11,
            color: count === max ? '#B23A2F' : '#2F4A3B',
            border: `2px solid ${count === max ? '#B23A2F' : '#2F4A3B'}`,
            padding: '2px 8px',
            borderRadius: 2,
            letterSpacing: '0.08em',
            opacity: 0.85,
            animation: 'stamp-land 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}
        >
          {count}/{max}
        </span>
        <span
          style={{
            fontFamily: "'Archivo', sans-serif",
            fontSize: 7,
            color: 'rgba(31,27,22,0.4)',
            letterSpacing: '0.15em',
            marginTop: 2,
            textTransform: 'uppercase',
          }}
        >
          authorized actions
        </span>
      </div>
    );
  }

  const isPass = state === 'pass';
  const color = isPass ? '#2F4A3B' : '#B23A2F';
  const label = isPass ? 'APPROVED' : 'BLOCKED';

  return (
    <div
      style={{
        display: 'inline-block',
        transform: 'rotate(-5deg)',
        animation: 'stamp-land 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "'Special Elite', serif",
          fontSize: 14,
          color,
          border: `2.5px solid ${color}`,
          padding: '3px 10px',
          borderRadius: 2,
          letterSpacing: '0.14em',
          display: 'inline-block',
          opacity: 0.82,
          boxShadow: `inset 0 0 0 1px ${color}20`,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );
}
