import type { WireLine } from '../lib/useRequestStream';
import { TeletypeLog } from '../components/wire/TeletypeLog';

interface Props {
  lines: WireLine[];
  onLineClick?: (requestId: string) => void;
}

const COLUMNS = ['Time', '', 'Agent', 'Tool', 'State', 'Proof hashes / reason'];

export function WireView({ lines, onLineClick }: Props) {
  const passCount = lines.filter((l) => l.outcome === 'pass').length;
  const failCount = lines.filter((l) => l.outcome === 'fail').length;
  const total     = lines.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--zk-sans)', color: '#0A3323' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, padding: '16px 22px 10px' }}>
        <div>
          <h1 style={{ font: '700 20px var(--zk-sans)', margin: 0, letterSpacing: '-0.01em' }}>The Wire</h1>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.65 }}>
            Live verification log. Hover a line to reveal proof digests, click it to inspect.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <Chip label="total"  value={total}     color="#0A3323" />
          <Chip label="passed" value={passCount} color="#53662D" />
          <Chip label="failed" value={failCount} color="#A8362C" />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: '0 22px 18px',
          border: '1.5px solid #0A3323',
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: '#FCFBEA',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="zk-wire-grid"
          style={{
            flexShrink: 0,
            padding: '9px 16px',
            backgroundColor: '#0A3323',
            color: '#F7F4D5',
            font: '500 11.5px var(--zk-sans)',
          }}
        >
          {COLUMNS.map((h, i) => (
            <span key={i} style={{ opacity: 0.75 }}>{h}</span>
          ))}
        </div>
        <TeletypeLog lines={lines} onLineClick={onLineClick} />
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 7,
        padding: '5px 12px',
        backgroundColor: '#FCFBEA',
        border: '1px solid rgba(10,51,35,0.16)',
        borderRadius: 8,
      }}
    >
      <b style={{ font: '500 15px var(--zk-mono)', color }}>{value}</b>
      <span style={{ fontSize: 12, opacity: 0.65 }}>{label}</span>
    </div>
  );
}
