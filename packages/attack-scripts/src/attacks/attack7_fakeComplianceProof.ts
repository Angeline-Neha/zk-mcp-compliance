import {
  AttackResult,
  FINANCE_URL,
  registerAgent,
  getNonce,
  sigmaProof,
  proveCompliance,
  circuitInput,
  randomSalt,
  POLICY,
} from "../common";
import { buildPoseidon } from "circomlibjs";

/**
 * Attack #7 — Fake compliance proof. Agent tries to submit a Groth16
 * proof for a different, more lenient policy than the one actually
 * registered. What should block it: TWO independent layers —
 *   (a) the circuit's own Poseidon commitment check (fails at witness
 *       generation if private params don't match the CLAIMED commitment)
 *   (b) the gate's registered-commitment check (fails even if (a) is
 *       satisfied by forging both the params AND a matching fake
 *       commitment together — closes the "forge both consistently" gap)
 *
 * This script demonstrates (b) specifically, through the REAL live
 * finance-mcp-server end to end, since (a) is already covered by
 * compliance-proving-service's own test suite.
 */
export async function attack7_fakeComplianceProof(): Promise<AttackResult> {
  const agent = await registerAgent("attacker-fake-policy", { action: "issue_refund", limit: 5000 });
  const nonce = await getNonce("issue_refund", "finance-mcp-server");
  const proof = await sigmaProof(agent.secretKey, agent.publicKey, {
    scope: "issue_refund",
    nonce,
    serverId: "finance-mcp-server",
  });

  // ATTACK: forge an entirely self-consistent fake policy — fake
  // policyLimit AND a matching fake commitment computed for it. The
  // circuit itself will be perfectly happy (internal consistency holds).
  const poseidon = await buildPoseidon();
  const fakeLimit = 999999;
  const fakeHash = poseidon([
    fakeLimit,
    POLICY.minAccountAgeDays,
    POLICY.maxPastRefundCount,
    POLICY.maxTransactionAgeDays,
    POLICY.policyLimitSalt,
  ]);
  const fakeCommitment = poseidon.F.toObject(fakeHash).toString();

  const amountSalt = randomSalt();
  const { status, body: proveBody } = await proveCompliance(
    circuitInput({
      amount: 5000, // only compliant under the FAKE, more lenient limit
      accountAgeDays: 45,
      pastRefundCount: 0,
      transactionAgeDays: 10,
      amountSalt,
      policyCommitment: fakeCommitment,
      policyLimit: fakeLimit,
    })
  );

  if (status !== 200) {
    // if the circuit itself already rejected it, the attack never even
    // gets a proof to submit — also a valid "blocked" outcome
    return {
      attack: "7: Fake compliance proof",
      blocked: true,
      reason: `blocked at proof-generation time (circuit rejected forged inputs): ${proveBody.error}`,
    };
  }

  const mcpRes = await fetch(`${FINANCE_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "issue_refund",
        arguments: {
          agentId: "attacker-fake-policy",
          attestationId: agent.attestationId,
          requestedScope: { action: "issue_refund", limit: 5000 },
          sigmaProof: proof,
          nonce,
          orderRef: "4522", // the real $5000 over-limit order
          claimedAmount: 5000,
          claimedAmountSalt: amountSalt,
          complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
        },
      },
    }),
  });

  const text = await mcpRes.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  const parsed = dataLine ? JSON.parse(dataLine.slice("data:".length).trim()) : null;
  const content = parsed?.result?.content?.[0]?.text;
  const resultBody = content ? JSON.parse(content) : null;

  const blocked = resultBody?.allowed === false;

  return {
    attack: "7: Fake compliance proof",
    blocked,
    reason: blocked
      ? `blocked correctly by the live gate: ${resultBody.reason}`
      : `VULNERABLE: a forged $999,999-limit policy proof was accepted (${JSON.stringify(resultBody)})`,
  };
}