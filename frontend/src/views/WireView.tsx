import type { WireLine } from '../lib/useRequestStream';
import { TeletypeLog } from '../components/wire/TeletypeLog';

interface Props {
  lines: WireLine[];
}

export function WireView({ lines }: Props) {
  const passCount = lines.filter((l) => l.outcome === 'pass').length;
  const failCount = lines.filter((l) => l.outcome === 'fail').length;
  const total     = lines.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#14110E',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 16px',
          borderBottom: '1px solid rgba(176,141,87,0.15)',
          backgroundColor: '#1A1510',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Special Elite', serif",
            fontSize: 11,
            color: '#B08D57',
            letterSpacing: '0.2em',
          }}
        >
          THE WIRE
        </span>

        <div style={{ display: 'flex', gap: 12, marginLeft: 8 }}>
          <MetaStat label="TOTAL"  value={String(total)}     color="#B08D57" />
          <MetaStat label="PASS"   value={String(passCount)} color="#4A8C6A" />
          <MetaStat label="FAIL"   value={String(failCount)} color="#B23A2F" />
        </div>

        {/* Column headers */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8,
            color: 'rgba(176,141,87,0.3)',
            letterSpacing: '0.1em',
          }}
        >
          {['TIME', '', 'AGENT', 'TOOL', 'STATE', 'PROOF HASHES / REASON'].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      </div>

      {/* Teletype area */}
      <TeletypeLog lines={lines} />
    </div>
  );
}

function MetaStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span
        style={{
          fontFamily: "'Archivo', sans-serif",
          fontSize: 8,
          color: 'rgba(176,141,87,0.4)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color,
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}
