/**
 * Prompt Injection / Intent Binding Attack (Attack #8)
 *
 * The authenticated customer really only authorized a refund for
 * `legitOrderRef`. A prompt-injected agent tries to also (or instead)
 * refund `injectedOrderRef` — an order that was never part of the
 * authenticated intent commitment.
 *
 * Pick the injected order's profile to explore both halves of the gap
 * this exhibit demonstrates:
 *   - a "fail" category order: Proof 2 alone would have caught it anyway
 *     (attack 8a from the write-up — blocked, but only by luck)
 *   - a "pass" category order: Proof 2 would go green — intent-binding is
 *     the ONLY thing standing between the injection and execution (attack
 *     8b — the case that actually motivates this whole exhibit)
 */
import { AttackDefinition, ParamDef } from "./types";
import {
  registerAgent,
  getNonce,
  sigmaProof,
  proveCompliance,
  circuitInput,
  randomSalt,
  realPolicyCommitment,
} from "@zk-mcp/attack-scripts";
import { randomUUID, createHash } from "crypto";
import { Pool } from "pg";
import { lookupRealOrder } from "./orderLookup";

const ISSUER_URL = process.env.ISSUER_URL ?? "http://localhost:4001";
const FINANCE_URL = process.env.FINANCE_URL ?? "http://localhost:4003";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp",
});

async function customerIdForOrder(orderRef: string): Promise<string> {
  const res = await pool.query("SELECT customer_id FROM orders WHERE order_ref = $1", [orderRef]);
  if (res.rows.length === 0) throw new Error(`Order "${orderRef}" not found — pick a real seeded order.`);
  return res.rows[0].customer_id as string;
}

interface Config {
  legitOrderRef?: string;
  injectedOrderRef?: string;
}

interface State {
  legitOrderRef: string;
  injectedOrderRef: string;
  legitCustomerId?: string;
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  sessionId?: string;
  intentNonce?: string;
  storedHash?: string;
  proof1?: { R: string; s: string };
  proof1Nonce?: string;
  proof2?: { proof: any; publicSignals: string[] };
  injectedAmountSalt?: string;
  injectedOrder?: { amount: number };
}

export const intentInjectionParams: ParamDef[] = [
  {
    key: "legitOrderRef",
    label: "Really-authorized order",
    type: "orderRef",
    default: "1001",
    help: "The order the authenticated customer actually asked to refund.",
  },
  {
    key: "injectedOrderRef",
    label: "Injected (smuggled) order",
    type: "orderRef",
    default: "2001",
    help: "Try a \"fail\" order (Proof 2 alone would've caught it) vs. a \"pass\" order (only intent-binding catches it).",
  },
];

export const intentInjectionAttack: AttackDefinition<State, Config> = {
  id: "8",
  title: "Intent Injection (Confused Deputy prompt injection)",
  params: intentInjectionParams,
  initialState: (config) => ({
    legitOrderRef: config?.legitOrderRef || "1001",
    injectedOrderRef: config?.injectedOrderRef || "2001",
  }),
  steps: [
    {
      label: "Register agent & get intent nonce",
      run: async (state) => {
        const legitCustomerId = await customerIdForOrder(state.legitOrderRef);
        const agent = await registerAgent("attacker-intent-injection", { action: "issue_refund", limit: 500 });
        const sessionId = randomUUID();
        const intentNonce = await getNonce("intent_commit", "support-agent").catch(() => randomUUID());
        return {
          result: {
            label: "Register agent & get intent nonce",
            narration: "The attacker sets up a legitimate session and requests a freshness nonce to commit their intent.",
            response: { agentId: "attacker-intent-injection", sessionId, intentNonce },
          },
          newState: { ...state, agent, sessionId, intentNonce, legitCustomerId },
        };
      },
    },
    {
      label: "Commit to authorized intent",
      run: async (state) => {
        const commitRes = await fetch(`${ISSUER_URL}/intent-commitment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.sessionId!,
            customerId: state.legitCustomerId!,
            orderRefs: [state.legitOrderRef],
            nonce: state.intentNonce!,
          }),
        });

        if (!commitRes.ok) {
          throw new Error(`Failed to register intent commitment for real order ${state.legitOrderRef}: ${await commitRes.text()}`);
        }

        const { commitmentHash: storedHash } = await commitRes.json();

        return {
          result: {
            label: "Commit to authorized intent",
            narration: `The user's real selection (order ${state.legitOrderRef}) is structurally validated against the DB and locked into a cryptographic commitment BEFORE the LLM is ever invoked.`,
            request: { customerId: state.legitCustomerId, orderRefs: [state.legitOrderRef] },
            response: { storedHash },
          },
          newState: { ...state, storedHash },
        };
      },
    },
    {
      label: "Sign Proof 1 bound to the intent hash",
      run: async (state) => {
        const proof1Nonce = await getNonce("issue_refund", "finance-mcp-server");
        const proof1 = await sigmaProof(state.agent!.secretKey, state.agent!.publicKey, {
          scope: "issue_refund",
          nonce: proof1Nonce,
          serverId: "finance-mcp-server",
          intentCommitmentHash: state.storedHash,
        });

        return {
          result: {
            label: "Sign Proof 1 bound to the intent hash",
            narration: "A standard authorization proof (Sigma protocol) is generated, but now the intent hash is mathematically woven into the Fiat-Shamir challenge.",
            response: { proof: proof1, intentCommitmentHash: state.storedHash },
          },
          newState: { ...state, proof1, proof1Nonce },
        };
      },
    },
    {
      label: "Forge an injected target using its REAL profile",
      run: async (state) => {
        const injectedOrder = await lookupRealOrder(state.injectedOrderRef);
        const policyCommitment = await realPolicyCommitment();
        const injectedAmountSalt = randomSalt();
        const { body: proveBody } = await proveCompliance(
          circuitInput({
            amount: injectedOrder.amount,
            accountAgeDays: injectedOrder.accountAgeDays,
            pastRefundCount: injectedOrder.pastRefundCount,
            transactionAgeDays: injectedOrder.transactionAgeDays,
            amountSalt: injectedAmountSalt,
            policyCommitment,
          })
        );

        const proof2Valid = !!proveBody.proof;

        return {
          result: {
            label: "Forge an injected target using its REAL profile",
            narration: proof2Valid
              ? `The attacker manipulates the LLM into targeting order ${state.injectedOrderRef} — never part of the authenticated intent. Its real profile is policy-compliant, so Proof 2 (Groth16) generates perfectly! Without intent-binding, this would execute.`
              : `The attacker manipulates the LLM into targeting order ${state.injectedOrderRef}. Its real profile actually fails policy on its own — Proof 2 will reject it regardless of intent-binding (this is the "caught by luck" case).`,
            response: { targetedOrder: state.injectedOrderRef, amount: injectedOrder.amount, proof2Valid },
            blocked: !proof2Valid,
          },
          newState: proof2Valid
            ? { ...state, proof2: proveBody, injectedAmountSalt, injectedOrder: { amount: injectedOrder.amount } }
            : { ...state, injectedOrder: { amount: injectedOrder.amount } },
        };
      },
    },
    {
      label: "Gate check intercepts injection",
      run: async (state) => {
        if (!state.proof2) {
          return {
            result: {
              label: "Gate check intercepts injection",
              narration: "Skipped — Proof 2 already failed on the injected order's own (non-compliant) data.",
              blocked: true,
            },
            newState: state,
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
                agentId: state.agent!.attestationId,
                attestationId: state.agent!.attestationId,
                requestedScope: { action: "issue_refund", limit: 500 },
                sigmaProof: state.proof1!,
                nonce: state.proof1Nonce!,
                orderRef: state.injectedOrderRef,
                claimedAmount: state.injectedOrder!.amount,
                claimedAmountSalt: state.injectedAmountSalt!,
                complianceProof: { proof: state.proof2!.proof, publicSignals: state.proof2!.publicSignals },
                sessionId: state.sessionId,
                intentCommitmentHash: state.storedHash,
              },
            },
          }),
        });

        const text = await mcpRes.text();
        const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
        const parsed = dataLine ? JSON.parse(dataLine.slice("data:".length).trim()) : null;
        const content = parsed?.result?.content?.[0]?.text;
        const resultBody = content ? JSON.parse(content) : null;

        const blocked = resultBody?.allowed === false && resultBody?.reason?.includes("INTENT_BINDING_FAIL");

        return {
          result: {
            label: "Gate check intercepts injection",
            narration: blocked
              ? `The finance gate blocks the attempt before Proof 2's result even matters. "${state.injectedOrderRef}" is not in the authenticated commitment [${state.legitOrderRef}].`
              : resultBody?.allowed
              ? "VULNERABLE — should be blocked."
              : `Blocked, but not by intent-binding: ${resultBody?.reason}`,
            response: resultBody,
            blocked: resultBody?.allowed !== true,
          },
          newState: state,
        };
      },
    },
  ],
};
