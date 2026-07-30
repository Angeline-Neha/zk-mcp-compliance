import { broadcast } from "./eventStore";
import { buildInspectorSnapshot } from "./extractInspector";
import { saveInspectorSnapshot } from "./inspectorStore";
import {
  deriveBoardState,
  derivePathFromTool,
  deriveStateFromAuditEntry,
  type BoardContext,
  type RequestPath,
  type RequestState,
} from "./boardState";

export interface GateResultLike {
  allowed?: boolean;
  reason?: string;
  proof1Valid?: boolean;
  proof2Valid?: boolean;
  intentBindingFail?: boolean;
}

export interface RequestUpdatePayload {
  requestId: string;
  timestamp: string;
  customerId?: string;
  orderRef?: string;
  agentId: string;
  tool: string;
  scopeAction?: string;
  state: RequestState;
  outcome: "pass" | "fail" | "pending";
  reason: string | null;
  proof1Hash?: string | null;
  proof2Hash?: string | null;
  policyCommitment?: string | null;
  boardState: ReturnType<typeof deriveBoardState>;
  docket: {
    agent: string;
    tool: string;
    outcome: "pass" | "fail" | "pending";
    ts: string;
  };
}

const TERMINAL_FAIL: RequestState[] = ["proof1_fail", "intent_fail", "proof2_fail", "rejected"];
const TERMINAL_PASS: RequestState[] = ["approved"];

/** Task-route completions — skip duplicate audit-log replay for same traffic. */
const recentTaskCompletions: { agentId: string; tool: string; at: number }[] = [];

function recordTaskCompletion(agentId: string, tool: string): void {
  recentTaskCompletions.push({ agentId, tool, at: Date.now() });
  if (recentTaskCompletions.length > 50) recentTaskCompletions.shift();
}

export function shouldSkipAuditEntry(entry: {
  agentId: string;
  toolName?: string | null;
  createdAt: string;
}): boolean {
  const tool = entry.toolName ?? "";
  const entryAt = new Date(entry.createdAt).getTime();
  return recentTaskCompletions.some(
    (r) =>
      r.agentId === entry.agentId &&
      r.tool === tool &&
      Math.abs(entryAt - r.at) < 20_000
  );
}

export function isTerminalState(state: RequestState): boolean {
  return TERMINAL_FAIL.includes(state) || TERMINAL_PASS.includes(state);
}

function outcomeForState(state: RequestState): "pass" | "fail" | "pending" {
  if (TERMINAL_PASS.includes(state)) return "pass";
  if (TERMINAL_FAIL.includes(state)) return "fail";
  return "pending";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  } catch {
    return "--:--:--";
  }
}

function agentLabel(agentId: string): string {
  return agentId.split("-").slice(0, 2).join("-");
}

export function emitRequestUpdate(payload: RequestUpdatePayload): void {
  broadcast("request_update", payload);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function emitStateSequence(
  base: Omit<RequestUpdatePayload, "state" | "outcome" | "boardState" | "docket"> & {
    docket: Omit<RequestUpdatePayload["docket"], "outcome">;
  },
  states: RequestState[],
  ctx: BoardContext,
  delayMs = 140
): Promise<void> {
  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    const outcome = outcomeForState(state);
    emitRequestUpdate({
      ...base,
      state,
      outcome,
      boardState: deriveBoardState(state, ctx),
      docket: { ...base.docket, outcome },
    });
    if (i < states.length - 1) await sleep(delayMs);
  }
}

export function deriveStateSequenceFromGateResult(
  result: GateResultLike,
  path: RequestPath
): RequestState[] {
  const reason = result.reason ?? null;
  const states: RequestState[] = [];

  const proof1Failed =
    result.proof1Valid === false ||
    (result.reason?.includes("Proof 1") ?? false) ||
    (result.reason?.includes("sigma") ?? false);

  if (proof1Failed) {
    states.push("proof1_fail", "rejected");
    return states;
  }

  states.push("proof1_pass");

  if (path === "refund") {
    states.push("intent_check_pending");

    if (result.intentBindingFail || result.reason?.includes("INTENT")) {
      states.push("intent_fail", "rejected");
      return states;
    }

    states.push("intent_pass", "proof2_pending");

    const proof2Failed =
      result.proof2Valid === false ||
      (result.allowed === false && !result.intentBindingFail);

    if (proof2Failed) {
      states.push("proof2_fail", "rejected");
      return states;
    }

    states.push("proof2_pass", "approved");
    return states;
  }

  // deletion path
  states.push("proof2_pending");
  if (result.allowed === false) {
    states.push("proof2_fail", "rejected");
    return states;
  }
  states.push("proof2_pass", "approved");
  return states;
}

function extractGateResult(raw: unknown, path: RequestPath): GateResultLike | null {
  const result = raw as {
    toolCalls?: { tool: string; result: unknown }[];
    supportAgentResults?: { toolCalls?: { tool: string; result: unknown }[] }[];
  };

  const toolCalls =
    path === "refund"
      ? (result.supportAgentResults?.[0]?.toolCalls ?? result.toolCalls ?? [])
      : (result.toolCalls ?? []);

  const toolName = path === "refund" ? "request_refund" : "request_deletion";
  const call = toolCalls.find((c) => c.tool === toolName);
  if (!call) return null;
  return call.result as GateResultLike;
}

export async function trackTaskRequest(opts: {
  requestId: string;
  path: RequestPath;
  customerId?: string;
  orderRef?: string;
  agentId: string;
  tool: string;
  scopeAction?: string;
  handler: () => Promise<unknown>;
}): Promise<unknown> {
  const ts = new Date().toISOString();
  const ctx: BoardContext = { path: opts.path };

  const base = {
    requestId: opts.requestId,
    timestamp: ts,
    customerId: opts.customerId,
    orderRef: opts.orderRef,
    agentId: opts.agentId,
    tool: opts.tool,
    scopeAction: opts.scopeAction,
    reason: null as string | null,
    proof1Hash: null as string | null,
    proof2Hash: null as string | null,
    policyCommitment: null as string | null,
    docket: {
      agent: agentLabel(opts.agentId),
      tool: opts.tool,
      ts: formatTime(ts),
    },
  };

  emitRequestUpdate({
    ...base,
    state: "queued",
    outcome: "pending",
    boardState: deriveBoardState("queued", ctx),
    docket: { ...base.docket, outcome: "pending" },
  });

  emitRequestUpdate({
    ...base,
    state: "proof1_pending",
    outcome: "pending",
    boardState: deriveBoardState("proof1_pending", ctx),
    docket: { ...base.docket, outcome: "pending" },
  });

  const raw = await opts.handler();
  const gateResult = extractGateResult(raw, opts.path);

  if (!gateResult) {
    await emitStateSequence(
      { ...base, reason: "No gate invocation" },
      ["rejected"],
      { ...ctx, reason: "No gate invocation" }
    );
    return raw;
  }

  const reason = gateResult.reason ?? null;
  const sequence = deriveStateSequenceFromGateResult(gateResult, opts.path);

  await emitStateSequence(
    {
      ...base,
      reason,
      proof1Hash: null,
      proof2Hash: null,
      policyCommitment: null,
    },
    sequence,
    { ...ctx, reason }
  );

  recordTaskCompletion(opts.agentId, opts.tool);

  const snapshot = buildInspectorSnapshot({
    requestId: opts.requestId,
    timestamp: ts,
    path: opts.path,
    customerId: opts.customerId,
    orderRef: opts.orderRef,
    agentId: opts.agentId,
    tool: opts.tool,
    raw,
  });
  if (snapshot) saveInspectorSnapshot(snapshot);

  return raw;
}

export function emitFromAuditEntry(entry: {
  id: string;
  createdAt: string;
  agentId: string;
  scopeAction?: string;
  toolName?: string;
  proof1Hash?: string | null;
  proof2Hash?: string | null;
  pass: boolean;
  reason?: string | null;
  policyCommitment?: string | null;
}): void {
  const path = derivePathFromTool(entry.toolName);
  const state = deriveStateFromAuditEntry(entry);
  const reason = entry.reason ?? null;
  const tool = entry.toolName ?? "unknown";
  const outcome = entry.pass ? "pass" : "fail";

  emitRequestUpdate({
    requestId: entry.id,
    timestamp: entry.createdAt,
    agentId: entry.agentId,
    tool,
    scopeAction: entry.scopeAction,
    state,
    outcome,
    reason,
    proof1Hash: entry.proof1Hash ?? null,
    proof2Hash: entry.proof2Hash ?? null,
    policyCommitment: entry.policyCommitment ?? null,
    boardState: deriveBoardState(state, { path, reason }),
    docket: {
      agent: agentLabel(entry.agentId),
      tool,
      outcome,
      ts: formatTime(entry.createdAt),
    },
  });
}
