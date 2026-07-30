import { CaseBoard, type CaseBoardState } from '../components/board/CaseBoard';

interface Props {
  boardState: CaseBoardState;
}

export function BoardView({ boardState }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CaseBoard
        boardState={boardState}
        onNodeClick={(id) => console.log('node clicked:', id)}
      />
    </div>
  );
}
