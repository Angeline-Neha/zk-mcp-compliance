import type { CheckpointState } from './topology';
import { pathPoint } from './Thread';

export interface CheckpointProps {
  id: string;
  state: CheckpointState;
  reason?: string;
  /** Two endpoints of the thread this checkpoint lives on */
  x1: number; y1: number; x2: number; y2: number;
  /** 0–1 along the bezier where the checkpoint sits */
  t?: number;
}

export function Checkpoint({ id, state, reason, x1, y1, x2, y2, t = 0.5 }: CheckpointProps) {
  if (state === 'hidden') return null;

  const pt = pathPoint(x1, y1, x2, y2, t);
  const cx = pt.x;
  const cy = pt.y;
  const r = 8;

  const color = state === 'pass' ? '#54C99A' : state === 'fail' ? '#E15068' : '#D9A94A';
  const symbol = state === 'pass' ? '✓' : state === 'fail' ? '✗' : '…';

  return (
    <g id={`checkpoint-${id}`}>
      {/* Turnstile gate body */}
      <circle cx={cx} cy={cy} r={r + 2} fill="#0D0817" stroke={color} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={state === 'pending' ? 0.2 : 0.12} />

      {/* Symbol */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: state === 'pending' ? 8 : 10,
          fontWeight: 600,
        }}
      >
        {state === 'pending' ? (
          <tspan style={{ animation: 'cursor-blink 1s step-end infinite' }}>█</tspan>
        ) : symbol}
      </text>

      {/* Turnstile bars (gate metaphor) */}
      {state !== 'pass' && (
        <>
          <line x1={cx - r - 4} y1={cy} x2={cx - r} y2={cy} stroke={color} strokeWidth={1.5} opacity={0.4} />
          <line x1={cx + r} y1={cy} x2={cx + r + 4} y2={cy} stroke={color} strokeWidth={1.5} opacity={0.4} />
        </>
      )}

      {/* Reason label below */}
      {state === 'fail' && reason && (
        <foreignObject x={cx - 80} y={cy + r + 6} width={160} height={40}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 8,
              color: '#E15068',
              textAlign: 'center',
              lineHeight: 1.4,
              backgroundColor: 'rgba(23,15,38,0.95)',
              padding: '2px 4px',
              borderRadius: 2,
              border: '1px solid rgba(225,80,104,0.3)',
            }}
          >
            {reason}
          </div>
        </foreignObject>
      )}
    </g>
  );
}
