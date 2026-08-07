export interface Objective {
  id: string;
  title: string;
  brief: string;
}

export const OBJECTIVES: Objective[] = [
  {
    id: "1",
    title: "Replay",
    brief:
      "Obtain one genuinely valid sigma proof for issue_refund against finance-mcp-server, then try to get it " +
      "accepted TWICE. A real system should burn the nonce on first use and reject the second attempt.",
  },
  {
    id: "2",
    title: "Confused Deputy",
    brief:
      "Register an identity scoped ONLY for issue_refund, then try to use its proof to call delete_account on " +
      "admin-mcp-server instead. A real system must check the attestation's scope exactly matches the tool " +
      "being invoked.",
  },
  {
    id: "3",
    title: "Privilege Escalation via Delegation",
    brief:
      "Register a parent identity with a SMALL refund limit (e.g. $100), have it delegate an even smaller scope " +
      "to a child, then have that child try to delegate a MUCH LARGER limit (e.g. $50,000) to a grandchild. " +
      "Delegation must only ever narrow scope, never widen it.",
  },
  {
    id: "4",
    title: "Lateral Movement",
    brief:
      "Without ever registering ANY identity for delete_account, fabricate an attestationId (any string) and try " +
      "to get a proof accepted for it against admin-mcp-server. There should be no attestation to find at all.",
  },
  {
    id: "5",
    title: "Cross-Server Credential Reuse",
    brief:
      "Register an identity for delete_account, get a nonce genuinely issued for admin-mcp-server, but generate " +
      "the sigma proof as if it were bound to finance-mcp-server instead. Then submit it as a real call_mcp_tool " +
      "delete_account request to admin-mcp-server. The serverId is baked into the challenge hash itself, so a " +
      "proof signed for the wrong server should fail the verification equation.",
  },
  {
    id: "6",
    title: "TOCTOU / Revocation Race",
    brief:
      "Register an identity for issue_refund, get a nonce, generate a valid proof — then revoke that same " +
      "attestation (simulating a just-detected compromise) BEFORE submitting the proof. Then try to submit the " +
      "still-algebraically-valid proof anyway via verify_proof1. Revocation should be re-checked at verify time, " +
      "not cached from generation time.",
  },
  {
    id: "7",
    title: "Fake Compliance Proof",
    brief:
      "Register an identity for issue_refund with a large limit, get a valid Proof 1. For Proof 2, use " +
      "prove_compliance with forgeFakePolicy=true and a large fakePolicyLimit (e.g. 999999) so a large refund " +
      "amount appears compliant under your forged policy. Then submit the whole thing as a real issue_refund " +
      "call_mcp_tool request. The gate should reject it because your forged policy commitment doesn't match the " +
      "one actually registered for this tool, independent of whether your own circuit accepted it.",
  },
];

export function getObjective(id: string): Objective {
  const o = OBJECTIVES.find((x) => x.id === id);
  if (!o) throw new Error(`unknown attack id "${id}" — red-team-agent only covers attacks 1-7`);
  return o;
}
