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
  /** 'beside' for vertical threads, 'above' for horizontal ones */
  labelPosition?: 'beside' | 'above';
}

export function Checkpoint({ id, state, reason, x1, y1, x2, y2, t = 0.5, labelPosition = 'beside' }: CheckpointProps) {
  if (state === 'hidden') return null;

  const pt = pathPoint(x1, y1, x2, y2, t);
  const cx = pt.x;
  const cy = pt.y;
  const r = 8;

  const color = state === 'pass' ? '#839958' : state === 'fail' ? '#A8362C' : '#5E2750';
  const filled = state !== 'pending';
  const symbol = state === 'pass' ? '✓' : state === 'fail' ? '✗' : '…';

  return (
    <g id={`checkpoint-${id}`}>
      {/* Turnstile gate body */}
      <circle cx={cx} cy={cy} r={r + 2} fill={filled ? color : '#FCFBEA'} stroke={state === 'pass' ? '#53662D' : color} strokeWidth={1.5} />

      {/* Symbol */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={filled ? '#FFFFFF' : color}
        style={{
          fontFamily: 'var(--zk-mono)',
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
          <line x1={cx - r - 4} y1={cy} x2={cx - r} y2={cy} stroke={color} strokeWidth={1.5} opacity={0.5} />
          <line x1={cx + r} y1={cy} x2={cx + r + 4} y2={cy} stroke={color} strokeWidth={1.5} opacity={0.5} />
        </>
      )}

      {/* Reason label beside the gate, so it never lands on the next card */}
      {state === 'fail' && reason && (
        <foreignObject
          x={labelPosition === 'above' ? cx - 80 : cx + r + 10}
          y={labelPosition === 'above' ? cy - r - 52 : cy - 18}
          width={labelPosition === 'above' ? 160 : 180}
          height={44}
        >
          <div
            style={{
              fontFamily: 'var(--zk-mono)',
              fontSize: 10,
              color: '#A8362C',
              textAlign: labelPosition === 'above' ? 'center' : 'left',
              lineHeight: 1.4,
              backgroundColor: '#F8E6E2',
              padding: '3px 6px',
              borderRadius: 4,
              border: '1px solid rgba(168,54,44,0.4)',
            }}
          >
            {reason}
          </div>
        </foreignObject>
      )}
    </g>
  );
}
