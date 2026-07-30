import type { CaseBoardState } from '../components/board/CaseBoard';
import type { NodeId, EdgeId, NodeVisualState, ThreadState, CheckpointState } from '../components/board/topology';

/* ── Event shapes from the backend ──────────────────────────────── */
export interface RequestUpdateEvent {
  requestId:   string;
  timestamp:   string;
  agentId:     string;
  tool:        string;
  scopeAction: string;
  state:       RequestState;
  outcome:     'pass' | 'fail';
  reason:      string | null;
  proof1Hash:  string | null;
  proof2Hash:  string | null;
  policyCommitment: string | null;
  boardState:  RawBoardState;
  docket: {
    agent:   string;
    tool:    string;
    outcome: 'pass' | 'fail';
    ts:      string;
  };
}

export interface StatsUpdateEvent {
  requestsPerMin: number;
  verifiedPct:    number;
  agentsOnline:   number;
  connected:      boolean;
}

export type RequestState =
  | 'queued'
  | 'proof1_pending'
  | 'proof1_pass'
  | 'proof1_fail'
  | 'intent_check_pending'
  | 'intent_pass'
  | 'intent_fail'
  | 'proof2_pending'
  | 'proof2_pass'
  | 'proof2_fail'
  | 'approved'
  | 'rejected';

export interface RawBoardState {
  nodes:  Record<string, string>;
  edges:  Record<string, { thread: string; checkpoint?: { state: string; reason?: string } }>;
  stamps: Record<string, { state: string; visible: boolean }>;
}

/* ── Convert raw backend board state → typed CaseBoardState ─────── */
export function rawToCaseBoardState(raw: RawBoardState): CaseBoardState {
  const nodes: CaseBoardState['nodes'] = {};
  for (const [id, visual] of Object.entries(raw.nodes)) {
    const stamp = raw.stamps?.[id];
    nodes[id as NodeId] = {
      visual: visual as NodeVisualState,
      stamp: stamp ? { state: stamp.state as 'pass' | 'fail', visible: stamp.visible } : undefined,
    };
  }

  const edges: CaseBoardState['edges'] = {};
  for (const [id, edge] of Object.entries(raw.edges)) {
    edges[id as EdgeId] = {
      thread: edge.thread as ThreadState,
      checkpoint: edge.checkpoint
        ? { state: edge.checkpoint.state as CheckpointState, reason: edge.checkpoint.reason }
        : undefined,
    };
  }

  return { nodes, edges };
}

/* ── Default idle board state ────────────────────────────────────── */
export const IDLE_BOARD_STATE: CaseBoardState = {
  nodes: {
    gateway:         { visual: 'idle' },
    'support-agent': { visual: 'idle' },
    'admin-agent':   { visual: 'idle' },
    issuer:          { visual: 'idle' },
    finance:         { visual: 'idle' },
    compliance:      { visual: 'idle' },
    'admin-mcp':     { visual: 'idle' },
  },
  edges: {
    'gateway->support-agent': { thread: 'idle' },
    'gateway->admin-agent':   { thread: 'idle' },
    'support-agent->issuer':  { thread: 'idle' },
    'support-agent->finance': { thread: 'idle' },
    'finance->compliance':    { thread: 'idle' },
    'admin-agent->admin-mcp': { thread: 'idle' },
  },
};
