/**
 * Maps request state-machine states → board node/edge visual states.
 * Shared by SSE emission and audit-log replay.
 */

export type RequestState =
  | "queued"
  | "proof1_pending"
  | "proof1_pass"
  | "proof1_fail"
  | "intent_check_pending"
  | "intent_pass"
  | "intent_fail"
  | "proof2_pending"
  | "proof2_pass"
  | "proof2_fail"
  | "approved"
  | "rejected";

export type RequestPath = "refund" | "deletion";

export interface RawBoardState {
  nodes: Record<string, string>;
  edges: Record<string, { thread: string; checkpoint?: { state: string; reason?: string }; telegram?: boolean }>;
  stamps: Record<string, { state: string; visible: boolean }>;
}

export interface BoardContext {
  path: RequestPath;
  reason?: string | null;
}

const IDLE_NODES: Record<string, string> = {
  gateway: "idle",
  "support-agent": "idle",
  "admin-agent": "idle",
  issuer: "idle",
  finance: "idle",
  compliance: "idle",
  "admin-mcp": "idle",
};

export function deriveBoardState(state: RequestState, ctx: BoardContext): RawBoardState {
  const { path, reason } = ctx;
  const isRefund = path === "refund";
  const isDeletion = path === "deletion";

  const nodes: Record<string, string> = { ...IDLE_NODES, gateway: "active" };
  const edges: RawBoardState["edges"] = {};
  const stamps: RawBoardState["stamps"] = {};

  if (isRefund) nodes["support-agent"] = "active";
  if (isDeletion) nodes["admin-agent"] = "active";

  switch (state) {
    case "queued":
      if (isRefund) {
        edges["gateway->support-agent"] = { thread: "pending", telegram: true };
      }
      if (isDeletion) {
        edges["gateway->admin-agent"] = { thread: "pending", telegram: true };
      }
      break;

    case "proof1_pending":
      if (isRefund) {
        edges["gateway->support-agent"] = { thread: "pass", telegram: true };
        edges["support-agent->issuer"] = { thread: "pending", checkpoint: { state: "pending" } };
        nodes.issuer = "active";
      }
      if (isDeletion) {
        edges["gateway->admin-agent"] = { thread: "pass", telegram: true };
        edges["admin-agent->admin-mcp"] = { thread: "pending", checkpoint: { state: "pending" } };
        nodes["admin-mcp"] = "active";
      }
      break;

    case "proof1_pass":
      if (isRefund) {
        edges["gateway->support-agent"] = { thread: "pass" };
        edges["support-agent->issuer"] = {
          thread: "pass",
          checkpoint: { state: "pass" },
        };
        nodes.issuer = "active";
      }
      if (isDeletion) {
        edges["gateway->admin-agent"] = { thread: "pass" };
        edges["admin-agent->admin-mcp"] = { thread: "pass", checkpoint: { state: "pass" } };
      }
      break;

    case "proof1_fail":
      if (isRefund) {
        edges["gateway->support-agent"] = { thread: "pass" };
        edges["support-agent->issuer"] = {
          thread: "fail",
          checkpoint: { state: "fail", reason: reason ?? "Proof 1 failed" },
        };
        stamps.issuer = { state: "fail", visible: true };
      }
      if (isDeletion) {
        edges["gateway->admin-agent"] = { thread: "pass" };
        edges["admin-agent->admin-mcp"] = {
          thread: "fail",
          checkpoint: { state: "fail", reason: reason ?? "Proof 1 failed" },
        };
        stamps["admin-mcp"] = { state: "fail", visible: true };
      }
      break;

    case "intent_check_pending":
      edges["gateway->support-agent"] = { thread: "pass" };
      edges["support-agent->issuer"] = { thread: "pass", checkpoint: { state: "pass" } };
      edges["support-agent->finance"] = { thread: "pending", checkpoint: { state: "pending" } };
      nodes.issuer = "active";
      nodes.finance = "active";
      break;

    case "intent_pass":
      edges["gateway->support-agent"] = { thread: "pass" };
      edges["support-agent->issuer"] = { thread: "pass", checkpoint: { state: "pass" } };
      edges["support-agent->finance"] = {
        thread: "pass",
        checkpoint: { state: "pass" },
      };
      nodes.finance = "active";
      break;

    case "intent_fail":
      edges["gateway->support-agent"] = { thread: "pass" };
      edges["support-agent->issuer"] = { thread: "pass", checkpoint: { state: "pass" } };
      edges["support-agent->finance"] = {
        thread: "fail",
        checkpoint: { state: "fail", reason: reason ?? "Intent binding failed" },
      };
      stamps.finance = { state: "fail", visible: true };
      break;

    case "proof2_pending":
      if (isRefund) {
        edges["gateway->support-agent"] = { thread: "pass" };
        edges["support-agent->issuer"] = { thread: "pass", checkpoint: { state: "pass" } };
        edges["support-agent->finance"] = { thread: "pass", checkpoint: { state: "pass" } };
        edges["finance->compliance"] = { thread: "pending", checkpoint: { state: "pending" } };
        nodes.finance = "active";
        nodes.compliance = "active";
      }
      if (isDeletion) {
        edges["gateway->admin-agent"] = { thread: "pass" };
        edges["admin-agent->admin-mcp"] = { thread: "pending", checkpoint: { state: "pending" } };
      }
      break;

    case "proof2_pass":
      if (isRefund) {
        edges["gateway->support-agent"] = { thread: "pass" };
        edges["support-agent->issuer"] = { thread: "pass", checkpoint: { state: "pass" } };
        edges["support-agent->finance"] = { thread: "pass", checkpoint: { state: "pass" } };
        edges["finance->compliance"] = { thread: "pass", checkpoint: { state: "pass" } };
        nodes.compliance = "active";
      }
      break;

    case "proof2_fail":
      if (isRefund) {
        edges["gateway->support-agent"] = { thread: "pass" };
        edges["support-agent->issuer"] = { thread: "pass", checkpoint: { state: "pass" } };
        edges["support-agent->finance"] = {
          thread: "fail",
          checkpoint: { state: "fail", reason: reason ?? "Proof 2 failed" },
        };
        stamps.finance = { state: "fail", visible: true };
      }
      if (isDeletion) {
        edges["gateway->admin-agent"] = { thread: "pass" };
        edges["admin-agent->admin-mcp"] = {
          thread: "fail",
          checkpoint: { state: "fail", reason: reason ?? "Policy check failed" },
        };
        stamps["admin-mcp"] = { state: "fail", visible: true };
      }
      break;

    case "approved":
      if (isRefund) {
        edges["gateway->support-agent"] = { thread: "pass" };
        edges["support-agent->issuer"] = { thread: "pass", checkpoint: { state: "pass" } };
        edges["support-agent->finance"] = { thread: "pass", checkpoint: { state: "pass" } };
        edges["finance->compliance"] = { thread: "pass", checkpoint: { state: "pass" } };
        nodes.finance = "active";
        nodes.compliance = "active";
        stamps.finance = { state: "pass", visible: true };
      }
      if (isDeletion) {
        edges["gateway->admin-agent"] = { thread: "pass" };
        edges["admin-agent->admin-mcp"] = { thread: "pass", checkpoint: { state: "pass" } };
        stamps["admin-mcp"] = { state: "pass", visible: true };
      }
      break;

    case "rejected":
      // Visual handled by the preceding fail state; keep gateway lit briefly
      break;
  }

  return { nodes, edges, stamps };
}

export function deriveStateFromAuditEntry(entry: {
  pass: boolean;
  reason?: string | null;
  toolName?: string | null;
}): RequestState {
  if (entry.pass) return "approved";
  const reason = entry.reason ?? "";
  if (reason.includes("Proof 1") || reason.includes("sigma")) return "proof1_fail";
  if (reason.includes("INTENT_BINDING") || reason.includes("intent")) return "intent_fail";
  return "proof2_fail";
}

export function derivePathFromTool(toolName?: string | null): RequestPath {
  const tool = toolName ?? "";
  if (tool.includes("delet")) return "deletion";
  return "refund";
}
