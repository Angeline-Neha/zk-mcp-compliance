/**
 * Salami Slicing Attack (Attack #9)
 *
 * The attacker repeats the exact same refund action many times against one
 * order. Each individual request looks perfectly legitimate and passes both
 * proofs — but the REAL ledger's pastRefundCount for that customer climbs
 * with every issued refund, so the compliance circuit (Proof 2) eventually
 * refuses to generate a passing proof once maxPastRefundCount is exceeded.
 *
 * This demonstrates that authorization isn't just per-request — it's
 * bounded over the lifetime of a customer's real refund history.
 *
 * Note: because this attack actually issues refunds against the real DB,
 * repeated runs against the SAME order will exhaust its refund budget —
 * pick a fresh order (or reseed the DB) if slice 1 unexpectedly fails.
 */
import { AttackDefinition, ParamDef } from "./types";
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
import { lookupRealOrder } from "./orderLookup";

interface Config {
  orderRef?: string;
}

interface State {
  orderRef: string;
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  policyCommitment?: string;
  realAmount?: number;
  sliceCount: number;
}

async function submitRefund(
  orderRef: string,
  amount: number,
  agent: NonNullable<State["agent"]>,
  policyCommitment: string
) {
  const nonce = await getNonce("issue_refund", "finance-mcp-server");
  const proof1 = await sigmaProof(agent.secretKey, agent.publicKey, {
    scope: "issue_refund",
    nonce,
    serverId: "finance-mcp-server",
  });
  const amountSalt = randomSalt();
  const order = await lookupRealOrder(orderRef);
  const { body: proveBody } = await proveCompliance(
    circuitInput({
      amount,
      accountAgeDays: order.accountAgeDays,
      pastRefundCount: order.pastRefundCount,
      transactionAgeDays: order.transactionAgeDays,
      amountSalt,
      policyCommitment,
    })
  );
  if (!proveBody.proof) {
    return { allowed: false, reason: "compliance proof generation failed (pastRefundCount likely exceeds policy already)" };
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
          agentId: "attacker-salami-demo",
          attestationId: agent.attestationId,
          requestedScope: { action: "issue_refund", limit: amount },
          sigmaProof: proof1,
          nonce,
          orderRef,
          claimedAmount: amount,
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

export const salamiSlicingParams: ParamDef[] = [
  {
    key: "orderRef",
    label: "Target order",
    type: "orderRef",
    category: "pass",
    default: "1005",
    help: "Pick any real, policy-compliant order. Each slice re-refunds this exact order at its real amount.",
  },
];

export const salamiSlicingAttack: AttackDefinition<State, Config> = {
  id: "9",
  title: "Salami Slicing",
  params: salamiSlicingParams,
  initialState: (config) => ({
    orderRef: config?.orderRef || "1005",
    sliceCount: 0,
  }),
  steps: [
    {
      label: "Look up the real order and register an agent",
      run: async (state) => {
        const order = await lookupRealOrder(state.orderRef);
        const agent = await registerAgent("attacker-salami-demo", { action: "issue_refund", limit: order.amount });
        const policyCommitment = await realPolicyCommitment();
        return {
          result: {
            label: "Look up the real order and register an agent",
            narration:
              `Order ${state.orderRef}'s real amount is $${order.amount}, well under policy — the attacker registers ` +
              `a credential scoped to exactly that amount. The plan: repeat the identical, individually-legitimate ` +
              `refund until cumulative damage is significant.`,
            response: { orderRef: state.orderRef, amount: order.amount, attestationId: agent.attestationId },
          },
          newState: { ...state, agent, policyCommitment, realAmount: order.amount },
        };
      },
    },
    {
      label: "Slice 1 — first refund (should pass)",
      run: async (state) => {
        const result = await submitRefund(state.orderRef, state.realAmount!, state.agent!, state.policyCommitment!);
        const blocked = result?.allowed === false;
        return {
          result: {
            label: "Slice 1 — first refund (should pass)",
            narration: blocked
              ? `Slice 1 unexpectedly BLOCKED: ${result?.reason}. This order may already have prior refunds from an ` +
                `earlier demo run — pick a fresh order and try again.`
              : "Slice 1 approved. The request looks completely legitimate in isolation — a small, policy-compliant refund.",
            response: result,
            blocked,
          },
          newState: { ...state, sliceCount: state.sliceCount + 1 },
        };
      },
    },
    {
      label: "Slice 2 — exact same request again",
      run: async (state) => {
        const result = await submitRefund(state.orderRef, state.realAmount!, state.agent!, state.policyCommitment!);
        const blocked = result?.allowed === false;
        return {
          result: {
            label: "Slice 2 — exact same request again",
            narration: blocked
              ? `Slice 2 BLOCKED: ${result?.reason}`
              : "Slice 2 approved. Still looks identical to any other refund — the same order, same proofs, same green light.",
            response: result,
            blocked,
          },
          newState: { ...state, sliceCount: state.sliceCount + 1 },
        };
      },
    },
    {
      label: "Slice 3 — same again, crossing threshold",
      run: async (state) => {
        const result = await submitRefund(state.orderRef, state.realAmount!, state.agent!, state.policyCommitment!);
        // The DB pastRefundCount constraint in the compliance circuit catches this
        // because each refund increments the real DB record. By slice 3+, pastRefundCount
        // in the real DB exceeds maxPastRefundCount, making a fresh proof impossible.
        const blocked = result?.allowed === false;
        return {
          result: {
            label: "Slice 3 — same again, crossing threshold",
            narration: blocked
              ? `BLOCKED at slice 3: "${result?.reason}". The compliance circuit (Proof 2) binds pastRefundCount from ` +
                `the REAL ledger — repeated slices against the same order are caught once the DB count exceeds the ` +
                `policy maximum.`
              : "Slice 3 passed — the system accepted another identical refund. This would be the vulnerability in a simpler system.",
            response: result,
            blocked,
          },
          newState: { ...state, sliceCount: state.sliceCount + 1 },
        };
      },
    },
  ],
};
