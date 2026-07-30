import type { WireLine } from '../../lib/useRequestStream';

interface Props {
  lines: WireLine[];
}

export function TeletypeLog({ lines }: Props) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10.5,
        lineHeight: 1.7,
        color: '#B08D57',
      }}
      className="scrollbar-paper"
    >
      {lines.length === 0 ? (
        <div style={{ opacity: 0.4, paddingTop: 40, textAlign: 'center' }}>
          <span style={{ animation: 'cursor-blink 1s step-end infinite', color: '#B08D57' }}>█</span>
          <p style={{ marginTop: 8, letterSpacing: '0.1em' }}>WIRE IDLE — AWAITING TRAFFIC…</p>
        </div>
      ) : (
        [...lines].reverse().map((line) => <TeletypeLine key={line.id} line={line} />)
      )}
    </div>
  );
}

function TeletypeLine({ line }: { line: WireLine }) {
  const outcomeColor = line.outcome === 'pass' ? '#4A8C6A' : '#B23A2F';
  const agentShort = line.agent.replace('-agent', '').replace('-service', '').replace('-mcp', '').toUpperCase();

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        borderBottom: '1px solid rgba(176,141,87,0.06)',
        paddingBottom: 1,
        marginBottom: 1,
      }}
    >
      {/* Timestamp */}
      <span style={{ color: 'rgba(176,141,87,0.4)', flexShrink: 0, width: 58 }}>
        {line.ts}
      </span>

      {/* Outcome marker */}
      <span style={{ color: outcomeColor, flexShrink: 0, width: 8 }}>
        {line.outcome === 'pass' ? '✓' : '✗'}
      </span>

      {/* Agent */}
      <span style={{ color: '#B08D57', flexShrink: 0, width: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {agentShort}
      </span>

      {/* Tool */}
      <span style={{ color: 'rgba(176,141,87,0.7)', flexShrink: 0, width: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {line.tool}
      </span>

      {/* State */}
      <span style={{ color: 'rgba(176,141,87,0.45)', flexShrink: 0, width: 110 }}>
        {line.state.replace(/_/g, ' ')}
      </span>

      {/* Proof hashes (truncated) */}
      {(line.proof1 || line.proof2) && (
        <span style={{ color: 'rgba(176,141,87,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {line.proof1 ? `p1:${line.proof1.slice(0, 8)}` : ''}
          {line.proof1 && line.proof2 ? ' ' : ''}
          {line.proof2 ? `p2:${line.proof2.slice(0, 8)}` : ''}
        </span>
      )}

      {/* Fail reason */}
      {line.reason && line.outcome === 'fail' && (
        <span style={{ color: '#B23A2F', opacity: 0.8, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {line.reason}
        </span>
      )}
    </div>
  );
}
