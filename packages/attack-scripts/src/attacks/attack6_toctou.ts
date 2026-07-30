import { AttackResult, registerAgent, getNonce, sigmaProof, verifyProof1, ISSUER_URL } from "../common";

/**
 * Attack #6 — TOCTOU / revocation race. Agent's credential is revoked,
 * but a proof it generated microseconds earlier is still "in flight" —
 * attacker tries to submit it after revocation. What should block it:
 * revocation is re-checked at VERIFY time, not cached from proof-
 * generation time.
 */
export async function attack6_toctou(): Promise<AttackResult> {
  const agent = await registerAgent("attacker-toctou", { action: "issue_refund", limit: 500 });
  const nonce = await getNonce("issue_refund", "finance-mcp-server");

  // proof generated WHILE the credential is still valid
  const proof = await sigmaProof(agent.secretKey, agent.publicKey, {
    scope: "issue_refund",
    nonce,
    serverId: "finance-mcp-server",
  });

  // credential gets revoked (e.g. key compromise detected) AFTER the
  // proof was generated but BEFORE it's submitted — this is the race
  await fetch(`${ISSUER_URL}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attestationId: agent.attestationId, reason: "simulated compromise for attack demo" }),
  });

  // ATTACK: submit the still-algebraically-valid proof AFTER revocation
  const result = await verifyProof1({
    attestationId: agent.attestationId,
    proof,
    nonce,
    serverId: "finance-mcp-server",
    requestedScope: { action: "issue_refund", limit: 500 },
  });

  return {
    attack: "6: TOCTOU / revocation race",
    blocked: result.valid === false,
    reason: result.valid
      ? "VULNERABLE: a proof from a revoked attestation was accepted"
      : `blocked correctly: ${result.reason}`,
  };
}