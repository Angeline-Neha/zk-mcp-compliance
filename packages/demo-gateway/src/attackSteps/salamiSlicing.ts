/**
 * Salami Slicing Attack (Attack #9)
 *
 * The attacker repeats the exact same refund action multiple times against
 * one order, hoping each individual request — which looks perfectly
 * legitimate in isolation — slips through.
 *
 * This version routes through the SAME mechanism the real Intake flow uses
 * (an intent commitment with expectedActionCount: 1, checked by
 * verifyIntentBinding in gate.ts) rather than the compliance circuit's
 * separate pastRefundCount<3 threshold. That's deliberate: it mirrors what
 * you'll see submitting the same order twice through Intake — the FIRST
 * identical action is authorized and passes, the moment it repeats it's
 * blocked, regardless of whether the transaction data itself would still
 * pass policy.
 *
 * (The compliance circuit's independent pastRefundCount<3 backstop is still
 * real and still enforced — it's just not what fires first here, because
 * intent-binding is deliberately the tighter, primary guard for this exact
 * attack pattern. See gate.ts's verifyIntentBinding for that check.)
 */
import { AttackDefinition, ParamDef } from "./types";
import {
  FINANCE_URL,
  ISSUER_URL,
  registerAgent,
  getNonce,
  sigmaProof,
  proveCompliance,
  circuitInput,
  randomSalt,
  realPolicyCommitment,
} from "@zk-mcp/attack-scripts";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { lookupRealOrder } from "./orderLookup";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp",
});

async function customerIdForOrder(orderRef: string): Promise<string> {
  const res = await pool.query("SELECT customer_id FROM orders WHERE order_ref = $1", [orderRef]);
  if (res.rows.length === 0) throw new Error(`Order "${orderRef}" not found — pick a real seeded order.`);
  return res.rows[0].customer_id as string;
}

interface Config {
  orderRef?: string;
}

interface State {
  orderRef: string;
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  policyCommitment?: string;
  realAmount?: number;
  sessionId?: string;
  intentCommitmentHash?: string;
  sliceCount: number;
}

async function submitRefund(
  orderRef: string,
  amount: number,
  agent: NonNullable<State["agent"]>,
  policyCommitment: string,
  sessionId: string,
  intentCommitmentHash: string
) {
  const nonce = await getNonce("issue_refund", "finance-mcp-server");
  const proof1 = await sigmaProof(agent.secretKey, agent.publicKey, {
    scope: "issue_refund",
    nonce,
    serverId: "finance-mcp-server",
    intentCommitmentHash,
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
          sessionId,
          intentCommitmentHash,
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
      label: "Look up the real order, register an agent, and commit intent (1 authorized action)",
      run: async (state) => {
        const order = await lookupRealOrder(state.orderRef);
        const customerId = await customerIdForOrder(state.orderRef);
        const agent = await registerAgent("attacker-salami-demo", { action: "issue_refund", limit: order.amount });
        const policyCommitment = await realPolicyCommitment();
        const sessionId = randomUUID();

        const commitRes = await fetch(`${ISSUER_URL}/intent-commitment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            customerId,
            orderRefs: [state.orderRef],
            nonce: randomUUID(),
            expirySeconds: 300,
          }),
        });
        if (!commitRes.ok) {
          throw new Error(`Failed to register intent commitment: ${await commitRes.text()}`);
        }
        const { commitmentHash: intentCommitmentHash } = await commitRes.json();

        return {
          result: {
            label: "Look up the real order, register an agent, and commit intent (1 authorized action)",
            narration:
              `Order ${state.orderRef}'s real amount is $${order.amount}. Exactly one action gets authorized for ` +
              `this session (expectedActionCount: 1) — the same mechanism the real Intake flow uses.`,
            response: { orderRef: state.orderRef, amount: order.amount, sessionId, expectedActionCount: 1 },
          },
          newState: { ...state, agent, policyCommitment, realAmount: order.amount, sessionId, intentCommitmentHash },
        };
      },
    },
    {
      label: "Slice 1 — first refund (authorized action, should pass)",
      run: async (state) => {
        const result = await submitRefund(
          state.orderRef,
          state.realAmount!,
          state.agent!,
          state.policyCommitment!,
          state.sessionId!,
          state.intentCommitmentHash!
        );
        const blocked = result?.allowed === false;
        return {
          result: {
            label: "Slice 1 — first refund (authorized action, should pass)",
            narration: blocked
              ? `Slice 1 unexpectedly BLOCKED: ${result?.reason}.`
              : "Slice 1 approved — this is the one action the intent commitment actually authorized.",
            response: result,
            blocked,
          },
          newState: { ...state, sliceCount: state.sliceCount + 1 },
        };
      },
    },
    {
      label: "Slice 2 — exact same request again (mimics Intake)",
      run: async (state) => {
        const result = await submitRefund(
          state.orderRef,
          state.realAmount!,
          state.agent!,
          state.policyCommitment!,
          state.sessionId!,
          state.intentCommitmentHash!
        );
        const blocked = result?.allowed === false;
        return {
          result: {
            label: "Slice 2 — exact same request again (mimics Intake)",
            narration: blocked
              ? `BLOCKED: "${result?.reason}". Same proofs, same order, same data as Slice 1 — but the intent ` +
                `commitment already spent its one authorized action. This is the same check that makes resubmitting ` +
                `an order through Intake reject on the second try.`
              : "Slice 2 passed — this would be the vulnerability in a simpler system.",
            response: result,
            blocked,
          },
          newState: { ...state, sliceCount: state.sliceCount + 1 },
        };
      },
    },
  ],
};
