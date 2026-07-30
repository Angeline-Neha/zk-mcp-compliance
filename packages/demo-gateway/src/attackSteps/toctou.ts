import { AttackDefinition } from "./types";
import { ISSUER_URL, registerAgent, getNonce, sigmaProof, verifyProof1 } from "@zk-mcp/attack-scripts";

interface State {
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  nonce?: string;
  proof?: { R: string; s: string };
}

export const toctouAttack: AttackDefinition<State> = {
  id: "6",
  title: "TOCTOU / Revocation Race",
  initialState: {},
  steps: [
    {
      label: "Register agent, get nonce, sign a valid proof",
      run: async (state) => {
        const agent = await registerAgent("attacker-toctou-demo", { action: "issue_refund", limit: 500 });
        const nonce = await getNonce("issue_refund", "finance-mcp-server");
        const proof = await sigmaProof(agent.secretKey, agent.publicKey, {
          scope: "issue_refund",
          nonce,
          serverId: "finance-mcp-server",
        });
        return {
          result: {
            label: "Register agent, get nonce, sign a valid proof",
            narration: "At this exact moment, the credential is fully valid and unrevoked.",
            response: { attestationId: agent.attestationId, nonce, proof },
          },
          newState: { ...state, agent, nonce, proof },
        };
      },
    },
    {
      label: "Revoke the attestation right now",
      run: async (state) => {
        const res = await fetch(`${ISSUER_URL}/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attestationId: state.agent!.attestationId,
            reason: "simulated compromise (live demo)",
          }),
        });
        return {
          result: {
            label: "Revoke the attestation right now",
            narration:
              "Simulating a compromise being detected — the credential is revoked mid-flight, after the proof above was already signed.",
            response: await res.json(),
          },
          newState: state,
        };
      },
    },
    {
      label: "Submit the still-algebraically-valid proof",
      run: async (state) => {
        const result = await verifyProof1({
          attestationId: state.agent!.attestationId,
          proof: state.proof!,
          nonce: state.nonce!,
          serverId: "finance-mcp-server",
          requestedScope: { action: "issue_refund", limit: 500 },
        });
        return {
          result: {
            label: "Submit the still-algebraically-valid proof",
            narration: result.valid
              ? "VULNERABLE — should never happen"
              : `REJECTED — ${result.reason}. Note: the algebra s·G == R+c·P still holds — this is a revocation check, not a math failure. Distinct from Attack #1/#5.`,
            response: result,
            blocked: !result.valid,
          },
          newState: state,
        };
      },
    },
  ],
};