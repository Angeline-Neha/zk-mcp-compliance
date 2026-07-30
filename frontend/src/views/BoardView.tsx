import { CaseBoard, type CaseBoardState } from '../components/board/CaseBoard';

interface Props {
  boardState: CaseBoardState;
  onInspectRequest?: (requestId: string) => void;
}

export function BoardView({ boardState, onInspectRequest }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CaseBoard boardState={boardState} onInspectRequest={onInspectRequest} />
    </div>
  );
}
