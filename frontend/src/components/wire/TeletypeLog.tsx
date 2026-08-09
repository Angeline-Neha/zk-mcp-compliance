import type { WireLine } from '../../lib/useRequestStream';

interface Props {
  lines: WireLine[];
  onLineClick?: (requestId: string) => void;
}

export function TeletypeLog({ lines, onLineClick }: Props) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10.5,
        lineHeight: 1.7,
        color: '#D9A94A',
      }}
      className="scrollbar-paper"
    >
      {lines.length === 0 ? (
        <div style={{ opacity: 0.4, paddingTop: 40, textAlign: 'center' }}>
          <span style={{ animation: 'cursor-blink 1s step-end infinite', color: '#D9A94A' }}>█</span>
          <p style={{ marginTop: 8, letterSpacing: '0.1em' }}>WIRE IDLE — AWAITING TRAFFIC…</p>
        </div>
      ) : (
        [...lines].reverse().map((line) => (
          <TeletypeLine key={line.id} line={line} onClick={onLineClick} />
        ))
      )}
    </div>
  );
}

function TeletypeLine({
  line,
  onClick,
}: {
  line: WireLine;
  onClick?: (requestId: string) => void;
}) {
  const outcomeColor = line.outcome === 'pass' ? '#6EDBB0' : '#E15068';
  const agentShort = line.agent.replace('-agent', '').replace('-service', '').replace('-mcp', '').toUpperCase();

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.(line.requestId)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(line.requestId)}
      className="wire-line-row"
      style={{
        display: 'flex',
        gap: 10,
        borderBottom: '1px solid rgba(217,169,74,0.06)',
        paddingBottom: 1,
        marginBottom: 1,
        cursor: onClick ? 'pointer' : 'default',
        animation: 'rise-in 0.25s ease-out both',
      }}
    >
      {/* Timestamp */}
      <span style={{ color: 'rgba(217,169,74,0.4)', flexShrink: 0, width: 58 }}>
        {line.ts}
      </span>

      {/* Outcome marker */}
      <span style={{ color: outcomeColor, flexShrink: 0, width: 8 }}>
        {line.outcome === 'pass' ? '✓' : '✗'}
      </span>

      {/* Agent */}
      <span style={{ color: '#D9A94A', flexShrink: 0, width: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {agentShort}
      </span>

      {/* Tool */}
      <span style={{ color: 'rgba(217,169,74,0.7)', flexShrink: 0, width: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {line.tool}
      </span>

      {/* State */}
      <span style={{ color: 'rgba(217,169,74,0.45)', flexShrink: 0, width: 110 }}>
        {line.state.replace(/_/g, ' ')}
      </span>

      {/* Proof hashes — sensitive digest material, live-masked until hovered */}
      {(line.proof1 || line.proof2) && (
        <span
          className="wire-redact-target"
          style={{ color: 'rgba(217,169,74,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, position: 'relative' }}
        >
          <span className="wire-redact-plain">
            {line.proof1 ? `p1:${line.proof1.slice(0, 8)}` : ''}
            {line.proof1 && line.proof2 ? ' ' : ''}
            {line.proof2 ? `p2:${line.proof2.slice(0, 8)}` : ''}
          </span>
          <span className="wire-redact-mask" aria-hidden="true">
            {line.proof1 ? 'p1:████████' : ''}
            {line.proof1 && line.proof2 ? ' ' : ''}
            {line.proof2 ? 'p2:████████' : ''}
          </span>
        </span>
      )}

      {/* Fail reason */}
      {line.reason && line.outcome === 'fail' && (
        <span style={{ color: '#E15068', opacity: 0.8, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {line.reason}
        </span>
      )}
    </div>
  );
}
