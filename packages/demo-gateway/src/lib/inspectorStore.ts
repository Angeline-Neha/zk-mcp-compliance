/**
 * In-memory inspector snapshots keyed by requestId.
 */

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
  sessionId?: string;
  state: string;
  outcome: "pass" | "fail" | "pending";
  failReason?: string | null;
  proof1Hash?: string | null;
  proof2Hash?: string | null;
  policyCommitment?: string | null;
  inspector: InspectorDetail;
}

const store = new Map<string, InspectorSnapshot>();
const MAX = 200;

export function saveInspectorSnapshot(snapshot: InspectorSnapshot): void {
  store.set(snapshot.requestId, snapshot);
  if (store.size > MAX) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
}

export function getInspectorSnapshot(requestId: string): InspectorSnapshot | undefined {
  return store.get(requestId);
}
