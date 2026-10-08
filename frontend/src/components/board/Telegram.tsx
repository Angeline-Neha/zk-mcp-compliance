import { pathPoint } from './Thread';

export interface TelegramProps {
  /** Call signature text */
  callSig: string;
  /** Thread endpoints for positioning */
  x1: number; y1: number; x2: number; y2: number;
  /** 0–1 position along thread */
  t?: number;
  visible: boolean;
}

export function Telegram({ callSig, x1, y1, x2, y2, t = 0.38, visible }: TelegramProps) {
  if (!visible) return null;

  const pt = pathPoint(x1, y1, x2, y2, t);
  const cx = pt.x;
  const cy = pt.y;

  // Width of the telegram card
  const w = 220;
  const h = 44;
  // Center horizontally, shift left/right based on available space
  const left = cx - w / 2;
  const top = cy - h / 2;

  return (
    <foreignObject x={left} y={top} width={w} height={h + 16} overflow="visible">
      <div
        style={{
          position: 'relative',
          width: w,
          backgroundColor: '#0A3323',
          borderRadius: 6,
          padding: '6px 10px',
          boxShadow: '0 4px 12px rgba(10,51,35,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--zk-sans)', fontSize: 10, color: '#D3968C', fontWeight: 600 }}>Call</span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(247,244,213,0.25)' }} />
        </div>
        <p
          style={{
            fontFamily: 'var(--zk-mono)',
            fontSize: 10,
            color: '#F7F4D5',
            lineHeight: 1.45,
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {callSig}
        </p>
      </div>
    </foreignObject>
  );
}
