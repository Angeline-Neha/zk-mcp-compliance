import { CaseBoard, type CaseBoardState } from '../components/board/CaseBoard';

interface Props {
  boardState: CaseBoardState;
  agentVitals: Record<string, number[]>;
  onInspectRequest?: (requestId: string) => void;
  viewingSnapshot?: boolean;
  onReturnToLive?: () => void;
}

const LEGEND: { label: string; color: string }[] = [
  { label: 'idle', color: '#9AA58A' },
  { label: 'request in flight', color: '#5E2750' },
  { label: 'proof verified', color: '#839958' },
  { label: 'proof failed', color: '#A8362C' },
];

export function BoardView({ boardState, agentVitals, onInspectRequest, viewingSnapshot, onReturnToLive }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--zk-sans)', color: '#0A3323' }}>
      <div style={{ flexShrink: 0, padding: '16px 22px 10px' }}>
        <h1 style={{ font: '700 20px var(--zk-sans)', margin: 0, letterSpacing: '-0.01em' }}>The Board</h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.65 }}>
          Live request topology across the services. Proof 1 gates the agent, Proof 2 gates the tool.
        </p>
      </div>

      {viewingSnapshot && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '0 22px 10px',
            padding: '7px 12px',
            borderRadius: 8,
            backgroundColor: 'rgba(94,39,80,0.12)',
            borderLeft: '3px solid #5E2750',
            fontSize: 13,
          }}
        >
          <span>Viewing a pinned request. Live updates are paused.</span>
          <button
            type="button"
            onClick={onReturnToLive}
            style={{
              marginLeft: 'auto',
              font: '600 12px var(--zk-sans)',
              color: '#fff',
              background: '#5E2750',
              border: 0,
              borderRadius: 6,
              padding: '5px 11px',
              cursor: 'pointer',
            }}
          >
            Return to live
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: '0 22px',
          border: '1.5px solid #0A3323',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <CaseBoard boardState={boardState} agentVitals={agentVitals} onInspectRequest={onInspectRequest} />
      </div>

      <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 18, padding: '10px 24px 14px', fontSize: 12, opacity: 0.8 }}>
        {LEGEND.map((l) => (
          <span key={l.label}>
            <span
              style={{
                display: 'inline-block',
                width: 18,
                height: 3,
                marginRight: 7,
                verticalAlign: 3,
                borderRadius: 2,
                backgroundColor: l.color,
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
