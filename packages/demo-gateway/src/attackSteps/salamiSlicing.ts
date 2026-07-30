/**
 * Salami Slicing Attack (Attack #9)
 *
 * The attacker repeats the exact same refund action many times in small
 * identical slices. Each individual request looks perfectly legitimate
 * and passes both proofs — but the gate tracks how many authorized actions
 * have been consumed and blocks once the session-level count is reached.
 *
 * This demonstrates that authorization isn't just per-request — it's
 * bounded over the lifetime of a session/attestation.
 */
import { AttackDefinition } from "./types";
import {
  FINANCE_URL,
  registerAgent,
  getNonce,
  sigmaProof,
  proveCompliance,
  circuitInput,
  randomSalt,
  realPolicyCommitment,
} from "@zk-mcp/attack-scripts";

interface State {
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  policyCommitment?: string;
  sliceCount: number;
  maxSlices: number;
  lastResult?: unknown;
}

async function submitRefund(agent: NonNullable<State["agent"]>, policyCommitment: string) {
  const nonce = await getNonce("issue_refund", "finance-mcp-server");
  const proof1 = await sigmaProof(agent.secretKey, agent.publicKey, {
    scope: "issue_refund",
    nonce,
    serverId: "finance-mcp-server",
  });
  const amountSalt = randomSalt();
  const { body: proveBody } = await proveCompliance(
    circuitInput({
      amount: 40,
      accountAgeDays: 60,
      pastRefundCount: 0,
      transactionAgeDays: 10,
      amountSalt,
      policyCommitment,
    })
  );
  if (!proveBody.proof) throw new Error("Compliance proof generation failed");

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
          agentId: "attacker-salami-demo",
          attestationId: agent.attestationId,
          requestedScope: { action: "issue_refund", limit: 40 },
          sigmaProof: proof1,
          nonce,
          orderRef: "10017",
          claimedAmount: 40,
          claimedAmountSalt: amountSalt,
          complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
        },
      },
    }),
  });

  const text = await mcpRes.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  const parsed = dataLine ? JSON.parse(dataLine.slice(5).trim()) : null;
  const content = parsed?.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

const MAX_SLICES = 3;

export const salamiSlicingAttack: AttackDefinition<State> = {
  id: "9",
  title: "Salami Slicing",
  initialState: { sliceCount: 0, maxSlices: MAX_SLICES },
  steps: [
    {
      label: "Register agent with a $40 limit",
      run: async (state) => {
        const agent = await registerAgent("attacker-salami-demo", { action: "issue_refund", limit: 40 });
        const policyCommitment = await realPolicyCommitment();
        return {
          result: {
            label: "Register agent with a $40 limit",
            narration:
              "The attacker registers a credential scoped to $40 refunds — each individual slice is well under the $150 policy limit. The plan: repeat it until the cumulative damage is significant.",
            response: { attestationId: agent.attestationId, limit: 40 },
          },
          newState: { ...state, agent, policyCommitment },
        };
      },
    },
    {
      label: "Slice 1 — first refund (should pass)",
      run: async (state) => {
        const result = await submitRefund(state.agent!, state.policyCommitment!);
        const blocked = result?.allowed === false;
        return {
          result: {
            label: "Slice 1 — first refund (should pass)",
            narration: blocked
              ? `Slice 1 unexpectedly BLOCKED: ${result?.reason}`
              : "Slice 1 approved. The request looks completely legitimate in isolation — a small, policy-compliant refund.",
            response: result,
            blocked,
          },
          newState: { ...state, sliceCount: state.sliceCount + 1, lastResult: result },
        };
      },
    },
    {
      label: "Slice 2 — exact same request again",
      run: async (state) => {
        const result = await submitRefund(state.agent!, state.policyCommitment!);
        const blocked = result?.allowed === false;
        return {
          result: {
            label: "Slice 2 — exact same request again",
            narration: blocked
              ? `Slice 2 BLOCKED: ${result?.reason}`
              : "Slice 2 approved. Still looks identical to any other refund. The gate has no stateful counter yet for this demo — each new nonce and proof is fresh.",
            response: result,
            blocked,
          },
          newState: { ...state, sliceCount: state.sliceCount + 1, lastResult: result },
        };
      },
    },
    {
      label: "Slice 3 — same again, crossing threshold",
      run: async (state) => {
        const result = await submitRefund(state.agent!, state.policyCommitment!);
        // The DB pastRefundCount constraint in the compliance circuit will catch this
        // because each refund increments the real DB record. By slice 3+, pastRefundCount
        // in the real DB exceeds maxPastRefundCount=3 making a fresh proof impossible.
        const blocked = result?.allowed === false;
        return {
          result: {
            label: "Slice 3 — same again, crossing threshold",
            narration: blocked
              ? `BLOCKED at slice 3: "${result?.reason}". The compliance circuit (Proof 2) binds pastRefundCount from the REAL ledger — repeated slices against the same order are caught when the DB count exceeds the policy maximum.`
              : "Slice 3 passed — the system accepted another identical refund. This would be the vulnerability in a simpler system.",
            response: result,
            blocked,
          },
          newState: { ...state, sliceCount: state.sliceCount + 1, lastResult: result },
        };
      },
    },
  ],
};
