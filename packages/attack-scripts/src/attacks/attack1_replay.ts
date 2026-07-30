import { AttackResult, registerAgent, getNonce, sigmaProof, verifyProof1 } from "../common";

/**
 * Attack #1 — Replay. Reuse a valid proof for the same action twice.
 * What should block it: nonce burn (Redis GETDEL, atomic).
 */
export async function attack1_replay(): Promise<AttackResult> {
  const agent = await registerAgent("attacker-replay", { action: "issue_refund", limit: 500 });
  const nonce = await getNonce("issue_refund", "finance-mcp-server");
  const proof = await sigmaProof(agent.secretKey, agent.publicKey, {
    scope: "issue_refund",
    nonce,
    serverId: "finance-mcp-server",
  });

  const verifyArgs = {
    attestationId: agent.attestationId,
    proof,
    nonce,
    serverId: "finance-mcp-server",
    requestedScope: { action: "issue_refund", limit: 500 },
  };

  const first = await verifyProof1(verifyArgs);
  if (!first.valid) {
    return { attack: "1: Replay", blocked: false, reason: `unexpected: first use itself failed (${first.reason})` };
  }

  // ATTACK: submit the exact same proof + nonce a second time
  const second = await verifyProof1(verifyArgs);

  return {
    attack: "1: Replay",
    blocked: second.valid === false,
    reason: second.valid
      ? "VULNERABLE: replayed proof was accepted a second time"
      : `blocked correctly: ${second.reason}`,
  };
}