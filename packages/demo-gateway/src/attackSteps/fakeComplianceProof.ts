import { AttackDefinition } from "./types";
import {
  FINANCE_URL,
  registerAgent,
  getNonce,
  sigmaProof,
  proveCompliance,
  circuitInput,
  randomSalt,
  POLICY,
} from "@zk-mcp/attack-scripts";
import { buildPoseidon } from "circomlibjs";

interface State {
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  nonce?: string;
  proof?: { R: string; s: string };
  fakeCommitment?: string;
  fakeLimit?: number;
  amountSalt?: string;
  complianceProof?: { proof: unknown; publicSignals: string[] };
}

export const fakeComplianceProofAttack: AttackDefinition<State> = {
  id: "7",
  title: "Fake Compliance Proof",
  initialState: {},
  steps: [
    {
      label: "Register agent, get nonce, sign valid Proof 1",
      run: async (state) => {
        const agent = await registerAgent("attacker-fake-policy-demo", { action: "issue_refund", limit: 5000 });
        const nonce = await getNonce("issue_refund", "finance-mcp-server");
        const proof = await sigmaProof(agent.secretKey, agent.publicKey, {
          scope: "issue_refund",
          nonce,
          serverId: "finance-mcp-server",
        });
        return {
          result: {
            label: "Register agent, get nonce, sign valid Proof 1",
            narration: "Proof 1 (authorization) will be entirely legitimate — this attack targets Proof 2 only.",
            response: { attestationId: agent.attestationId, nonce, proof },
          },
          newState: { ...state, agent, nonce, proof },
        };
      },
    },
    {
      label: "Forge a fake policy: fake $999,999 limit",
      run: async (state) => ({
        result: {
          label: "Forge a fake policy: fake $999,999 limit",
          narration: "The attacker decides to use a wildly more lenient (fake) refund limit than what's actually registered.",
          response: { fakeLimit: 999999 },
        },
        newState: { ...state, fakeLimit: 999999 },
      }),
    },
    {
      label: "Compute a matching fake commitment (self-consistent)",
      run: async (state) => {
        const poseidon = await buildPoseidon();
        const fakeHash = poseidon([
          state.fakeLimit,
          POLICY.minAccountAgeDays,
          POLICY.maxPastRefundCount,
          POLICY.maxTransactionAgeDays,
          POLICY.policyLimitSalt,
        ]);
        const fakeCommitment = poseidon.F.toObject(fakeHash).toString();
        return {
          result: {
            label: "Compute a matching fake commitment (self-consistent)",
            narration:
              "The circuit's own internal check only verifies self-consistency — it can't tell this commitment wasn't actually registered anywhere.",
            response: { fakeCommitment },
          },
          newState: { ...state, fakeCommitment },
        };
      },
    },
    {
      label: "Generate the Groth16 proof with forged params",
      run: async (state) => {
        const amountSalt = randomSalt();
        const { status, body } = await proveCompliance(
          circuitInput({
            amount: 5000,
            accountAgeDays: 45,
            pastRefundCount: 0,
            transactionAgeDays: 10,
            amountSalt,
            policyCommitment: state.fakeCommitment!,
            policyLimit: state.fakeLimit,
          })
        );
        return {
          result: {
            label: "Generate the Groth16 proof with forged params",
            narration:
              status === 200
                ? "The circuit accepts it — internally consistent, so a real, valid-looking Groth16 proof comes out."
                : "Circuit rejected it outright — attack blocked even earlier than expected.",
            response: { status, publicSignals: body.publicSignals },
            blocked: status !== 200,
          },
          newState: {
            ...state,
            amountSalt,
            complianceProof: status === 200 ? { proof: body.proof, publicSignals: body.publicSignals } : undefined,
          },
        };
      },
    },
    {
      label: "Submit both proofs to the real finance-mcp-server",
      run: async (state) => {
        if (!state.complianceProof) {
          return {
            result: {
              label: "Submit both proofs to the real finance-mcp-server",
              narration: "Skipped — already blocked at proof generation.",
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
                agentId: "attacker-fake-policy-demo",
                attestationId: state.agent!.attestationId,
                requestedScope: { action: "issue_refund", limit: 5000 },
                sigmaProof: state.proof,
                nonce: state.nonce,
                orderRef: "4522",
                claimedAmount: 5000,
                claimedAmountSalt: state.amountSalt,
                complianceProof: state.complianceProof,
              },
            },
          }),
        });
        const text = await mcpRes.text();
        const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
        const parsed = dataLine ? JSON.parse(dataLine.slice(5).trim()) : null;
        const content = parsed?.result?.content?.[0]?.text;
        const resultBody = content ? JSON.parse(content) : null;
        const blocked = resultBody?.allowed === false;
        return {
          result: {
            label: "Submit both proofs to the real finance-mcp-server",
            narration: blocked
              ? `REJECTED — ${resultBody.reason}. The gate checks against the ACTUALLY registered commitment, not just circuit self-consistency.`
              : "VULNERABLE — should never happen",
            response: resultBody,
            blocked,
          },
          newState: state,
        };
      },
    },
  ],
};