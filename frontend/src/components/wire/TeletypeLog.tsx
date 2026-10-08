import type { WireLine } from '../../lib/useRequestStream';

interface Props {
  lines: WireLine[];
  onLineClick?: (requestId: string) => void;
}

export function TeletypeLog({ lines, onLineClick }: Props) {
  return (
    <div
      className="zk-wire-scroll"
      style={{
        flex: 1,
        overflowY: 'auto',
        fontFamily: 'var(--zk-mono)',
        fontSize: 12.5,
        color: '#0A3323',
      }}
    >
      {lines.length === 0 ? (
        <div style={{ paddingTop: 48, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--zk-sans)', fontWeight: 600, fontSize: 14, margin: 0, opacity: 0.7 }}>
            Wire idle
          </p>
          <p style={{ margin: '4px 0 0', opacity: 0.5 }}>
            Awaiting traffic<span className="cursor-blink" />
          </p>
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
  const failed = line.outcome === 'fail';
  const outcomeColor = line.outcome === 'pass' ? '#53662D' : failed ? '#A8362C' : '#5E2750';
  const agentShort = line.agent.replace('-agent', '').replace('-service', '').replace('-mcp', '');

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.(line.requestId)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(line.requestId)}
      className={`wire-line-row zk-wire-grid${failed ? ' wire-line-row--fail' : ''}`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <span style={{ opacity: 0.55 }}>{line.ts}</span>

      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          backgroundColor: outcomeColor,
        }}
      >
        {line.outcome === 'pass' ? '✓' : failed ? '✕' : '…'}
      </span>

      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentShort}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{line.tool}</span>
      <span style={{ opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {line.state.replace(/_/g, ' ')}
      </span>

      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {(line.proof1 || line.proof2) && (
          <span className="wire-redact-target" style={{ color: '#5E2750' }}>
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
        {line.reason && failed && (
          <span style={{ color: '#A8362C', marginLeft: line.proof1 || line.proof2 ? 12 : 0 }}>{line.reason}</span>
        )}
      </span>
    </div>
  );
}
