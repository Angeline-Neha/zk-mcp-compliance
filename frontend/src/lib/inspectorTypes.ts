export interface InspectorProof1 {
  R: string;
  s: string;
  c: string;
  publicKey: string;
  scope: string;
  nonce: string;
  serverId: string;
  intentCommitmentHash?: string;
  checks: {
    algebra: { ok: boolean; detail: string };
    nonce: { ok: boolean; detail: string; ttlMs?: number };
    scope: { ok: boolean; detail: string };
    revocation: { ok: boolean; detail: string };
  };
}

export interface InspectorDetail {
  proof1: InspectorProof1;
  intentCheck?: {
    ok: boolean;
    orderRef?: string;
    committedOrderRefs?: string[];
    message: string;
  };
  proof2?: {
    circuitId: string;
    timingMs: number;
    proofSizeBytes: number;
    approved: boolean;
    policyCommitment?: string;
    toolScope: string;
    constraints: { name: string; ok: boolean }[];
  };
}

export interface InspectorSnapshot {
  requestId: string;
  timestamp: string;
  agentId: string;
  tool: string;
  orderRef?: string;
  customerId?: string;
  state: string;
  outcome: "pass" | "fail" | "pending";
  failReason?: string | null;
  proof1Hash?: string | null;
  proof2Hash?: string | null;
  policyCommitment?: string | null;
  inspector: InspectorDetail | null;
  partial?: boolean;
}

export type CheckStatus = "pending" | "pass" | "fail";

export function checkStatus(ok: boolean | undefined, resolved: boolean): CheckStatus {
  if (!resolved) return "pending";
  return ok ? "pass" : "fail";
}
