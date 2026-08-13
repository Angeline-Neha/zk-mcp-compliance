export interface Objective {
  id: string;
  title: string;
  brief: string;
}

// Mirrors @zk-mcp/red-team-agent's OBJECTIVES 1-7 one-for-one, so the same
// attack numbers can be shown side-by-side on the comparison arm. The ZK
// agent tests these against real cryptographic primitives (sigma proofs,
// nonces, attestations); this agent tests the SAME conceptual attacks
// against baseline-agent's plain if-chain policy + no-crypto plumbing.
export const OBJECTIVES: Objective[] = [
  {
    id: "1",
    title: "Replay",
    brief:
      "First call lookup_order with orderRef \"1001\" (or whatever real orderRef you're told below) to confirm " +
      "it exists and who owns it. Then call submit_refund with that exact same customerId and orderRef TWICE in " +
      "a row, with identical arguments both times. A real system burns the request as 'already used' after the " +
      "first success, so the second identical call should be rejected. Do not change any field between the two calls.",
  },
  {
    id: "2",
    title: "Confused Deputy",
    brief:
      "Call lookup_order to find a real orderRef you own. Then call submit_confused_deputy with that orderRef and " +
      "action set to \"delete\" instead of \"refund\" — you are only authorized to request refunds, but this tool " +
      "lets you pass an arbitrary action string. A real system would cryptographically bind your credential's " +
      "scope to 'refund' only, so a request claiming 'delete' should be rejected regardless of what you pass.",
  },
  {
    id: "3",
    title: "Privilege Escalation",
    brief:
      "Call lookup_order on a real order you own whose amount exceeds the standard refund policy limit (try an " +
      "order over $150). Then call submit_privilege_escalation for that order, passing claimedLimit set to a " +
      "large number (e.g. 100000) in the same call — this simulates a caller claiming a higher approval " +
      "authority than they actually have. A real system commits the policy limit cryptographically at " +
      "registration time, so a caller-claimed limit should never change the outcome.",
  },
  {
    id: "4",
    title: "IDOR / Order Swap",
    brief:
      "Call lookup_order on a few different orderRefs (try \"1001\", \"1002\", \"2001\", \"2002\", \"9001\") to " +
      "find one that is policy-compliant (amount under $150, etc.) but is NOT owned by your own customerId. Then " +
      "call submit_idor with that orderRef only (no customerId check available on this tool) to see if a refund " +
      "is issued for an order you don't own. A real system binds ownership into the request before any policy " +
      "check runs, independent of the caller's identity claims.",
  },
  {
    id: "5",
    title: "Cross-Service Reuse",
    brief:
      "Call lookup_order to find a real order you own. Then call submit_cross_service for that order, setting " +
      "serviceHeader to a service name you were never issued credentials for (e.g. \"admin-service\" or " +
      "\"partner-portal\"). A real system binds the credential to a specific audience/service, so presenting it " +
      "under a different claimed service should be rejected regardless of what string is passed.",
  },
  {
    id: "6",
    title: "TOCTOU / Revoked Session",
    brief:
      "Call create_session with your customerId to get a sessionId. Then call revoke_session with that exact " +
      "sessionId to revoke it (simulating a compromise being detected). Then, using a real order you own, call " +
      "submit_toctou_refund passing that SAME now-revoked sessionId. A real system re-checks revocation status " +
      "at the moment of use, not just at session-creation time, so a revoked session should not be able to " +
      "authorize anything afterward.",
  },
  {
    id: "7",
    title: "Fake Compliance Proof",
    brief:
      "Call lookup_order on a real order that FAILS the standard policy on its real values (e.g. amount over " +
      "$150, or account age under 30 days). Then call submit_fake_compliance for that order, passing fakeFields " +
      "with values that would pass policy (e.g. amount: 50, accountAgeDays: 365, pastRefundCount: 0, " +
      "transactionAgeDays: 10) instead of the real ones. A real system evaluates policy against values committed " +
      "from the database at proof time, not values the caller supplies in the request body.",
  },
];

export function getObjective(id: string): Objective {
  const o = OBJECTIVES.find((x) => x.id === id);
  if (!o) throw new Error(`unknown attack id "${id}" — baseline-red-team-agent only covers attacks 1-7`);
  return o;
}
