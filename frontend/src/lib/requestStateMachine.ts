import type { CaseBoardState, BoardEdgeState, BoardNodeState } from '../components/board/CaseBoard';
import type { NodeId, EdgeId, NodeVisualState, ThreadState, CheckpointState } from '../components/board/topology';

/* ── Event shapes from the backend ──────────────────────────────── */
export interface RequestUpdateEvent {
  requestId:   string;
  timestamp:   string;
  customerId?: string;
  orderRef?:   string;
  agentId:     string;
  tool:        string;
  scopeAction?: string;
  state:       RequestState;
  outcome:     'pass' | 'fail' | 'pending';
  reason:      string | null;
  proof1Hash:  string | null;
  proof2Hash:  string | null;
  policyCommitment: string | null;
  boardState:  RawBoardState;
  docket: {
    agent:   string;
    tool:    string;
    outcome: 'pass' | 'fail' | 'pending';
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
  edges:  Record<string, { thread: string; checkpoint?: { state: string; reason?: string }; telegram?: boolean }>;
  stamps: Record<string, { state: string; visible: boolean }>;
}

export interface ThreadPulse {
  requestId: string;
  startedAt: number;
  opacity:   number;
}

/* ── Tracked request (rolling window) ───────────────────────────── */
export interface TrackedRequest {
  requestId:  string;
  state:      RequestState;
  outcome:    'pass' | 'fail' | 'pending';
  updatedAt:  number;
  startedAt:  number;
  agentId:    string;
  tool:       string;
  reason:     string | null;
  boardSlice: CaseBoardState;
  docket:     RequestUpdateEvent['docket'];
}

export const RESOLVED_TTL_MS   = 4000;
export const PULSE_FADE_AGE_MS = 8000;
export const MAX_ACTIVE        = 20;
export const MAX_PULSES_EDGE   = 4;
export const MAX_DOCKET        = 1000;
export const MAX_WIRE          = 200;

const TERMINAL_STATES = new Set<RequestState>([
  'approved', 'rejected', 'proof1_fail', 'intent_fail', 'proof2_fail',
]);

const THREAD_PRIORITY: Record<ThreadState, number> = {
  fail: 4,
  pending: 3,
  pass: 2,
  idle: 1,
  'no-path': 0,
};

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
      telegram: edge.telegram,
    };
  }

  return { nodes, edges };
}

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

/** Active edge for pulse placement based on current state. */
function pulseEdgeForState(state: RequestState, tool: string): EdgeId | null {
  const isDeletion = tool.includes('delet');
  switch (state) {
    case 'queued':
      return isDeletion ? 'gateway->admin-agent' : 'gateway->support-agent';
    case 'proof1_pending':
    case 'proof1_pass':
    case 'proof1_fail':
      return isDeletion ? 'admin-agent->admin-mcp' : 'support-agent->issuer';
    case 'intent_check_pending':
    case 'intent_pass':
    case 'intent_fail':
      return 'support-agent->finance';
    case 'proof2_pending':
    case 'proof2_pass':
    case 'proof2_fail':
      return isDeletion ? 'admin-agent->admin-mcp' : 'finance->compliance';
    case 'approved':
      return isDeletion ? 'admin-agent->admin-mcp' : 'finance->compliance';
    default:
      return null;
  }
}

function mergeNodeState(existing: BoardNodeState | undefined, incoming: BoardNodeState): BoardNodeState {
  const visualPriority: Record<NodeVisualState, number> = {
    unauthorized: 4,
    targeted: 3,
    active: 2,
    idle: 1,
  };
  const existingVisual = existing?.visual ?? 'idle';
  const pickVisual =
    visualPriority[incoming.visual] >= visualPriority[existingVisual]
      ? incoming.visual
      : existingVisual;

  const stamp = incoming.stamp?.visible ? incoming.stamp : existing?.stamp;

  return { visual: pickVisual, stamp };
}

function mergeEdgeState(existing: BoardEdgeState | undefined, incoming: BoardEdgeState): BoardEdgeState {
  const existingThread = existing?.thread ?? 'idle';
  const pickThread =
    THREAD_PRIORITY[incoming.thread] >= THREAD_PRIORITY[existingThread]
      ? incoming.thread
      : existingThread;

  const checkpoint = incoming.checkpoint ?? existing?.checkpoint;
  const telegram = incoming.telegram || existing?.telegram;

  return { thread: pickThread, checkpoint, telegram };
}

export function mergeBoardSlice(into: CaseBoardState, slice: CaseBoardState): void {
  for (const [id, ns] of Object.entries(slice.nodes) as [NodeId, BoardNodeState][]) {
    into.nodes[id] = mergeNodeState(into.nodes[id], ns);
  }
  for (const [id, es] of Object.entries(slice.edges) as [EdgeId, BoardEdgeState][]) {
    into.edges[id] = mergeEdgeState(into.edges[id], es);
  }
}

/** Merge all in-flight + recently-resolved requests into one board view. */
export function mergeActiveRequests(requests: TrackedRequest[], now = Date.now()): CaseBoardState {
  const merged: CaseBoardState = {
    nodes: { ...IDLE_BOARD_STATE.nodes },
    edges: { ...IDLE_BOARD_STATE.edges },
  };

  const visible = requests.filter(
    (r) => !TERMINAL_STATES.has(r.state) || now - r.updatedAt < RESOLVED_TTL_MS
  );

  // Oldest first so newer requests win merge conflicts
  const sorted = [...visible].sort((a, b) => a.updatedAt - b.updatedAt);

  for (const req of sorted) {
    mergeBoardSlice(merged, req.boardSlice);
  }

  // Concurrent pulses — queue per edge, max N, fade older ones
  const pulseBuckets = new Map<EdgeId, ThreadPulse[]>();

  for (const req of visible) {
    if (TERMINAL_STATES.has(req.state)) continue;
    const edgeId = pulseEdgeForState(req.state, req.tool);
    if (!edgeId) continue;

    const age = now - req.startedAt;
    const opacity = age > PULSE_FADE_AGE_MS ? 0.4 : 1;

    const bucket = pulseBuckets.get(edgeId) ?? [];
    bucket.push({ requestId: req.requestId, startedAt: req.startedAt, opacity });
    pulseBuckets.set(edgeId, bucket);
  }

  for (const [edgeId, pulses] of pulseBuckets) {
    const sortedPulses = pulses
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_PULSES_EDGE);

    merged.edges[edgeId] = {
      ...merged.edges[edgeId],
      thread: merged.edges[edgeId]?.thread === 'idle' ? 'pending' : merged.edges[edgeId]?.thread ?? 'pending',
      pulses: sortedPulses,
    };
  }

  return merged;
}

export function upsertTrackedRequest(
  map: Map<string, TrackedRequest>,
  ev: RequestUpdateEvent,
  now = Date.now()
): Map<string, TrackedRequest> {
  const next = new Map(map);
  const existing = next.get(ev.requestId);

  next.set(ev.requestId, {
    requestId: ev.requestId,
    state: ev.state,
    outcome: ev.outcome,
    updatedAt: now,
    startedAt: existing?.startedAt ?? now,
    agentId: ev.agentId,
    tool: ev.tool,
    reason: ev.reason,
    boardSlice: rawToCaseBoardState(ev.boardState),
    docket: ev.docket,
  });

  // Trim oldest resolved requests beyond window
  if (next.size > MAX_ACTIVE) {
    const entries = [...next.entries()].sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    const trimmed = new Map(entries.slice(0, MAX_ACTIVE));
    return trimmed;
  }

  return next;
}

export function isTerminalState(state: RequestState): boolean {
  return TERMINAL_STATES.has(state);
}