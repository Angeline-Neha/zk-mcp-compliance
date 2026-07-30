import { AttackResult, registerAgent, getNonce, sigmaProof, verifyProof1 } from "../common";

/**
 * Attack #2 — Confused deputy. Use a refund-scoped credential to call
 * delete_account. What should block it: attestation scope-match check.
 */
export async function attack2_confusedDeputy(): Promise<AttackResult> {
  // agent is ONLY attested for issue_refund
  const agent = await registerAgent("attacker-confused-deputy", { action: "issue_refund", limit: 500 });
  const nonce = await getNonce("delete_account", "admin-mcp-server");
  const proof = await sigmaProof(agent.secretKey, agent.publicKey, {
    scope: "delete_account", // attacker signs a proof CLAIMING delete_account scope
    nonce,
    serverId: "admin-mcp-server",
  });

  // ATTACK: try to verify this proof as if it authorizes delete_account,
  // when the attestation itself only ever held issue_refund
  const result = await verifyProof1({
    attestationId: agent.attestationId,
    proof,
    nonce,
    serverId: "admin-mcp-server",
    requestedScope: { action: "delete_account" },
  });

  return {
    attack: "2: Confused deputy",
    blocked: result.valid === false,
    reason: result.valid
      ? "VULNERABLE: refund-scoped credential was accepted for delete_account"
      : `blocked correctly: ${result.reason}`,
  };
}