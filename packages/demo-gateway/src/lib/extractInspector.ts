import type { InspectorDetail, InspectorSnapshot } from "./inspectorStore";
import type { RequestPath } from "./boardState";
import type { GateResultLike } from "./requestEvents";

function extractGateResultWithInspector(
  raw: unknown,
  path: RequestPath
): (GateResultLike & { inspector?: InspectorDetail }) | null {
  const result = raw as {
    toolCalls?: { tool: string; input?: unknown; result: unknown }[];
    supportAgentResults?: { toolCalls?: { tool: string; input?: unknown; result: unknown }[] }[];
  };

  const toolCalls =
    path === "refund"
      ? (result.supportAgentResults?.[0]?.toolCalls ?? result.toolCalls ?? [])
      : (result.toolCalls ?? []);

  const toolName = path === "refund" ? "request_refund" : "request_deletion";
  const call = toolCalls.find((c) => c.tool === toolName);
  if (!call) return null;
  const gateResult = call.result as GateResultLike & { inspector?: InspectorDetail };
  const callInput = call.input as { overridden?: boolean; requestedOrderRef?: string; orderRef?: string } | undefined;
  if (callInput?.overridden) {
    (gateResult as any).override = {
      requestedOrderRef: callInput.requestedOrderRef,
      enforcedOrderRef: callInput.orderRef,
    };
  }
  return gateResult;
}

export function buildInspectorSnapshot(opts: {
  requestId: string;
  timestamp: string;
  path: RequestPath;
  customerId?: string;
  orderRef?: string;
  agentId: string;
  tool: string;
  raw: unknown;
}): InspectorSnapshot | null {
  const gate = extractGateResultWithInspector(opts.raw, opts.path);
  if (!gate?.inspector) return null;

  const reason = gate.reason ?? null;
  const outcome = gate.allowed ? "pass" : "fail";
  const state = gate.allowed ? "approved" : "rejected";

  return {
    requestId: opts.requestId,
    timestamp: opts.timestamp,
    agentId: opts.agentId,
    tool: opts.tool,
    orderRef: opts.orderRef ?? gate.inspector.intentCheck?.orderRef,
    customerId: opts.customerId,
    state,
    outcome,
    failReason: reason,
    policyCommitment: gate.inspector.proof2?.policyCommitment ?? null,
    inspector: gate.inspector,
    override: (gate as any).override,
  };
}
