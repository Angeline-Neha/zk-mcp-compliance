import { AttackDefinition } from "./types";
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

const ISSUER_URL = process.env.ISSUER_URL ?? "http://localhost:4001";
const FINANCE_URL = process.env.FINANCE_URL ?? "http://localhost:4003";

interface State {
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  sessionId?: string;
  intentNonce?: string;
  storedHash?: string;
  proof1?: { R: string; s: string };
  proof1Nonce?: string;
  proof2?: { proof: any; publicSignals: string[] };
  injectedAmountSalt?: string;
}

export const intentInjectionAttack: AttackDefinition<State> = {
  id: "8",
  title: "Intent Injection (Confused Deputy prompt injection)",
  initialState: {},
  steps: [
    {
      label: "Register agent & get intent nonce",
      run: async (state) => {
        const agent = await registerAgent("attacker-intent-injection", { action: "issue_refund", limit: 500 });
        const sessionId = randomUUID();
        const intentNonce = await getNonce("intent_commit", "support-agent").catch(() => randomUUID());
        return {
          result: {
            label: "Register agent & get intent nonce",
            narration: "The attacker sets up a legitimate session and requests a freshness nonce to commit their intent.",
            response: { agentId: "attacker-intent-injection", sessionId, intentNonce },
          },
          newState: { ...state, agent, sessionId, intentNonce },
        };
      },
    },
    {
      label: "Commit to authorized intent (Order 9102)",
      run: async (state) => {
        const commitmentPreimage = ["cust-ok-2", "9102", state.intentNonce!, Date.now().toString()].join("|");
        const commitmentHash = createHash("sha256").update(commitmentPreimage).digest("hex");

        const commitRes = await fetch(`${ISSUER_URL}/intent-commitment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.sessionId!,
            customerId: "cust-ok-2",
            orderRefs: ["9102"],
            nonce: state.intentNonce!,
          }),
        });

        if (!commitRes.ok) {
          throw new Error("Failed to register intent commitment (missing DB fixture for cust-ok-2 / 9102)");
        }
        
        const { commitmentHash: storedHash } = await commitRes.json();
        
        return {
          result: {
            label: "Commit to authorized intent (Order 9102)",
            narration: "The user's real selection (order 9102) is structurally validated against the DB and locked into a cryptographic commitment BEFORE the LLM is ever invoked.",
            request: { customerId: "cust-ok-2", orderRefs: ["9102"] },
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
      label: "Forge an injected target (Order 9101)",
      run: async (state) => {
        const policyCommitment = await realPolicyCommitment();
        const injectedAmountSalt = randomSalt();
        const { body: proveBody } = await proveCompliance(
          circuitInput({
            amount: 50, // perfectly compliant amount
            accountAgeDays: 60, 
            pastRefundCount: 0,
            transactionAgeDays: 30,
            amountSalt: injectedAmountSalt,
            policyCommitment,
          })
        );

        if (!proveBody.proof) throw new Error("Failed to generate Proof 2 for injected order");

        return {
          result: {
            label: "Forge an injected target (Order 9101)",
            narration: "The attacker manipulates the LLM into targeting a completely different order (9101). Because the order profile is compliant, Proof 2 (Groth16) generates perfectly! Without intent-binding, the system would execute this.",
            response: { targetedOrder: "9101", amount: 50, proof2Valid: true },
          },
          newState: { ...state, proof2: proveBody, injectedAmountSalt },
        };
      },
    },
    {
      label: "Gate check intercepts injection",
      run: async (state) => {
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
                orderRef: "9101", // The injected target
                claimedAmount: 50,
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
              ? `The finance gate blocks the attempt before Proof 2 even runs. "9101" is not in the authenticated commitment [9102].`
              : "VULNERABLE — should be blocked.",
            response: resultBody,
            blocked,
          },
          newState: state,
        };
      },
    }
  ],
};
