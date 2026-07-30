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
          backgroundColor: '#EDE6D6',
          border: '1px solid rgba(31,27,22,0.25)',
          borderRadius: 2,
          padding: '6px 10px',
          boxShadow: '1px 2px 6px rgba(31,27,22,0.15)',
          // Torn-edge effect via clip-path on top
          clipPath:
            'polygon(0% 8%, 3% 0%, 6% 7%, 9% 1%, 12% 8%, 15% 2%, 18% 8%, 21% 1%, 24% 8%, 27% 2%, 30% 8%, 33% 1%, 36% 8%, 39% 1%, 42% 7%, 45% 0%, 48% 7%, 51% 1%, 54% 7%, 57% 0%, 60% 7%, 63% 1%, 66% 7%, 69% 0%, 72% 7%, 75% 1%, 78% 7%, 81% 0%, 84% 7%, 87% 1%, 90% 7%, 93% 0%, 96% 7%, 100% 2%, 100% 100%, 0% 100%)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span
            style={{
              fontFamily: "'Special Elite', serif",
              fontSize: 8,
              color: '#B08D57',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            TELEGRAM
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(176,141,87,0.3)' }} />
        </div>
        {/* Call signature */}
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8,
            color: '#1F1B16',
            lineHeight: 1.45,
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
