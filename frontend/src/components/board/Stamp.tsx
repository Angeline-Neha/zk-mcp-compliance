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
            color: count === max ? '#E15068' : '#54C99A',
            border: `2px solid ${count === max ? '#E15068' : '#54C99A'}`,
            padding: '2px 8px',
            borderRadius: 2,
            letterSpacing: '0.08em',
            opacity: 0.85,
            animation: 'stamp-land-overshoot 0.5s cubic-bezier(.2,1.6,.4,1) forwards',
          }}
        >
          {count}/{max}
        </span>
        <span
          style={{
            fontFamily: "'Archivo', sans-serif",
            fontSize: 7,
            color: 'rgba(233,228,242,0.4)',
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
  const color = isPass ? '#54C99A' : '#E15068';
  const label = isPass ? 'APPROVED' : 'BLOCKED';

  return (
    <div
      style={{
        display: 'inline-block',
        transform: 'rotate(-5deg)',
        animation: 'stamp-land-overshoot 0.5s cubic-bezier(.2,1.6,.4,1) forwards',
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
          boxShadow: `inset 0 0 0 1px ${color}20, 0 0 14px ${color}30`,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );
}
