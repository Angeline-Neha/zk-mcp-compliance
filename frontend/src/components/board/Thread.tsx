import type { ThreadState } from './topology';
import type { ThreadPulse } from '../../lib/requestStateMachine';

interface ThreadRect {
  cx: number;
  top: number;
  bottom: number;
}

export interface ThreadProps {
  id: string;
  fromRect?: ThreadRect;
  toRect?: ThreadRect;
  state: ThreadState;
  pulses?: ThreadPulse[];
}

const THREAD_COLORS: Record<ThreadState, string> = {
  idle:    '#B08D57',
  pending: '#B08D57',
  pass:    '#2F4A3B',
  fail:    '#B23A2F',
  'no-path': 'transparent',
};

function cubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const dy = y2 - y1;
  const dx = x2 - x1;
  const cpY = Math.abs(dy) > Math.abs(dx) ? dy * 0.45 : Math.abs(dy) * 0.6;
  const cpX = dx * 0.1;
  return `M ${x1} ${y1} C ${x1 + cpX} ${y1 + cpY} ${x2 - cpX} ${y2 - cpY} ${x2} ${y2}`;
}

function pathPoint(x1: number, y1: number, x2: number, y2: number, t: number) {
  const dy = y2 - y1;
  const dx = x2 - x1;
  const cpY = Math.abs(dy) > Math.abs(dx) ? dy * 0.45 : Math.abs(dy) * 0.6;
  const cpX = dx * 0.1;
  const cx1 = x1 + cpX; const cy1 = y1 + cpY;
  const cx2 = x2 - cpX; const cy2 = y2 - cpY;
  const mt = 1 - t;
  return {
    x: mt*mt*mt*x1 + 3*mt*mt*t*cx1 + 3*mt*t*t*cx2 + t*t*t*x2,
    y: mt*mt*mt*y1 + 3*mt*mt*t*cy1 + 3*mt*t*t*cy2 + t*t*t*y2,
  };
}

export function Thread({ id, fromRect, toRect, state, pulses }: ThreadProps) {
  if (state === 'no-path' || !fromRect || !toRect) return null;

  const x1 = fromRect.cx;
  const y1 = fromRect.bottom;
  const x2 = toRect.cx;
  const y2 = toRect.top;

  const color = THREAD_COLORS[state];
  const d = cubicPath(x1, y1, x2, y2);
  const pinR = 3.5;

  const hasPulses = (pulses?.length ?? 0) > 0;
  const showTravel = state === 'pass' || state === 'pending' || hasPulses;

  return (
    <g id={`thread-${id}`}>
      <path
        d={d}
        fill="none"
        stroke="rgba(31,27,22,0.08)"
        strokeWidth={4}
        strokeLinecap="round"
      />

      {state === 'pending' || (hasPulses && state === 'idle') ? (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="6 4"
          style={{ animation: 'dash-march 0.6s linear infinite' }}
        />
      ) : state === 'fail' ? (
        <>
          <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeDasharray="4 3" opacity={0.7} />
          <FractureMarker x={x2} y={y2} />
        </>
      ) : (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      )}

      <circle cx={x1} cy={y1} r={pinR} fill="#B08D57" opacity={0.7} />
      <circle cx={x1} cy={y1} r={pinR - 1.5} fill="#EDE6D6" />
      <circle cx={x2} cy={y2} r={pinR} fill="#B08D57" opacity={0.7} />
      <circle cx={x2} cy={y2} r={pinR - 1.5} fill="#EDE6D6" />

      {/* Single pulse for pass/pending thread state */}
      {showTravel && !hasPulses && (
        <TravelPulse d={d} color={color} />
      )}

      {/* Concurrent pulse queue (Phase 3) */}
      {pulses?.map((pulse, i) => (
        <TravelPulse
          key={pulse.requestId}
          d={d}
          color={color}
          opacity={pulse.opacity}
          begin={`${i * 0.35}s`}
        />
      ))}
    </g>
  );
}

function FractureMarker({ x, y }: { x: number; y: number }) {
  return (
    <g opacity={0.7}>
      <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} stroke="#B23A2F" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} stroke="#B23A2F" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
}

function TravelPulse({
  d,
  color,
  opacity = 0.6,
  begin = '0s',
}: {
  d: string;
  color: string;
  opacity?: number;
  begin?: string;
}) {
  return (
    <circle r="4" fill={color} opacity={opacity}>
      <animateMotion
        dur="1.8s"
        repeatCount="indefinite"
        path={d}
        rotate="auto"
        begin={begin}
      />
    </circle>
  );
}

export { pathPoint };
