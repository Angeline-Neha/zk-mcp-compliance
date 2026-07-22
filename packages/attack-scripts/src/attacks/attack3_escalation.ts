import { ISSUER_URL, AttackResult, registerAgent } from "../common";
import { generateKeyPair } from "@zk-mcp/sigma-core";

/**
 * Attack #3 — Privilege escalation via delegation. Agent B was delegated
 * a narrow refund limit by Agent A, tries to delegate itself (or a
 * sub-agent C) a much larger limit. What should block it: delegation
 * must only ever narrow scope, never widen — Issuer-enforced subset check.
 */
export async function attack3_escalation(): Promise<AttackResult> {
  const agentA = await registerAgent("attacker-parent-A", { action: "issue_refund", limit: 100 });
  const { publicKey: agentBPublicKey } = generateKeyPair();

  // Agent A legitimately delegates a NARROW scope to Agent B
  const delegateRes = await fetch(`${ISSUER_URL}/delegate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentAttestationId: agentA.attestationId,
      childAgentId: "attacker-child-B",
      childPublicKey: agentBPublicKey,
      requestedScope: { action: "issue_refund", limit: 50 },
      expirySeconds: 3600,
    }),
  });
  const delegateBody = await delegateRes.json();
  if (!delegateRes.ok) {
    return { attack: "3: Privilege escalation", blocked: false, reason: `setup failed: ${JSON.stringify(delegateBody)}` };
  }
  const agentBAttestationId = delegateBody.attestation.id;

  // ATTACK: Agent B, holding only a $50 limit, tries to delegate a sub-agent C a MUCH larger limit
  const { publicKey: agentCPublicKey } = generateKeyPair();
  const escalateRes = await fetch(`${ISSUER_URL}/delegate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentAttestationId: agentBAttestationId,
      childAgentId: "attacker-grandchild-C",
      childPublicKey: agentCPublicKey,
      requestedScope: { action: "issue_refund", limit: 50000 }, // WAY more than B's own $50
      expirySeconds: 3600,
    }),
  });
  const escalateBody = await escalateRes.json();

  return {
    attack: "3: Privilege escalation",
    blocked: !escalateRes.ok,
    reason: escalateRes.ok
      ? "VULNERABLE: agent with a $50 limit successfully delegated a $50,000 limit"
      : `blocked correctly: ${escalateBody.reason}`,
  };
}