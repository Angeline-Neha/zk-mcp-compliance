import { CaseBoard, type CaseBoardState } from '../components/board/CaseBoard';

interface Props {
  boardState: CaseBoardState;
  agentVitals: Record<string, number[]>;
  onInspectRequest?: (requestId: string) => void;
  viewingSnapshot?: boolean;
  onReturnToLive?: () => void;
}

export function BoardView({ boardState, agentVitals, onInspectRequest, viewingSnapshot, onReturnToLive }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {viewingSnapshot && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '6px 10px',
            borderBottom: '1px solid rgba(176,141,87,0.3)',
            backgroundColor: 'rgba(31,27,22,0.9)',
            fontFamily: 'monospace',
            fontSize: 9,
            letterSpacing: '0.08em',
            color: '#B08D57',
          }}
        >
          VIEWING PINNED REQUEST — LIVE UPDATES PAUSED
          <button
            type="button"
            onClick={onReturnToLive}
            style={{
              fontSize: 9,
              color: '#EDE6D6',
              background: 'none',
              border: '1px solid rgba(237,230,214,0.4)',
              borderRadius: 2,
              padding: '1px 6px',
              cursor: 'pointer',
            }}
          >
            ● RETURN TO LIVE
          </button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CaseBoard boardState={boardState} agentVitals={agentVitals} onInspectRequest={onInspectRequest} />
      </div>
    </div>
  );
}