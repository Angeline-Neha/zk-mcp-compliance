import { CaseBoard, type CaseBoardState } from '../components/board/CaseBoard';

interface Props {
  boardState: CaseBoardState;
  agentVitals: Record<string, number[]>;
  onInspectRequest?: (requestId: string) => void;
}

export function BoardView({ boardState, agentVitals, onInspectRequest }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CaseBoard boardState={boardState} agentVitals={agentVitals} onInspectRequest={onInspectRequest} />
    </div>
  );
}
