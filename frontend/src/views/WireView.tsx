import type { WireLine } from '../lib/useRequestStream';
import { TeletypeLog } from '../components/wire/TeletypeLog';

interface Props {
  lines: WireLine[];
  onLineClick?: (requestId: string) => void;
}

export function WireView({ lines, onLineClick }: Props) {
  const passCount = lines.filter((l) => l.outcome === 'pass').length;
  const failCount = lines.filter((l) => l.outcome === 'fail').length;
  const total     = lines.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#05030A',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 16px',
          borderBottom: '1px solid rgba(217,169,74,0.15)',
          backgroundColor: '#0D0817',
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
            color: '#D9A94A',
            letterSpacing: '0.2em',
          }}
        >
          THE WIRE
        </span>

        <div style={{ display: 'flex', gap: 12, marginLeft: 8 }}>
          <MetaStat label="TOTAL"  value={String(total)}     color="#D9A94A" />
          <MetaStat label="PASS"   value={String(passCount)} color="#6EDBB0" />
          <MetaStat label="FAIL"   value={String(failCount)} color="#E15068" />
        </div>

        {/* Column headers */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 8,
            color: 'rgba(217,169,74,0.3)',
            letterSpacing: '0.1em',
          }}
        >
          {['TIME', '', 'AGENT', 'TOOL', 'STATE', 'PROOF HASHES / REASON'].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      </div>

      {/* Teletype area */}
      <TeletypeLog lines={lines} onLineClick={onLineClick} />
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
          color: 'rgba(217,169,74,0.4)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
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
