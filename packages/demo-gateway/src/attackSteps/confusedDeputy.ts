import { AttackDefinition } from "./types";
import { registerAgent, getNonce, sigmaProof, verifyProof1 } from "@zk-mcp/attack-scripts";

interface State {
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  nonce?: string;
  proof?: { R: string; s: string };
}

export const confusedDeputyAttack: AttackDefinition<State> = {
  id: "2",
  title: "Confused Deputy",
  initialState: {},
  steps: [
    {
      label: "Register agent with ONLY issue_refund scope",
      run: async (state) => {
        const agent = await registerAgent("attacker-confused-deputy-demo", { action: "issue_refund", limit: 500 });
        return {
          result: {
            label: "Register agent with ONLY issue_refund scope",
            narration: "This credential is attested for refunds only — never delete_account.",
            response: { attestationId: agent.attestationId },
          },
          newState: { ...state, agent },
        };
      },
    },
    {
      label: "Sign a proof claiming delete_account scope",
      run: async (state) => {
        const nonce = await getNonce("delete_account", "admin-mcp-server");
        const proof = await sigmaProof(state.agent!.secretKey, state.agent!.publicKey, {
          scope: "delete_account",
          nonce,
          serverId: "admin-mcp-server",
        });
        return {
          result: {
            label: "Sign a proof claiming delete_account scope",
            narration: "The attacker signs a proof for a scope this credential was never granted.",
            response: { nonce, proof },
          },
          newState: { ...state, nonce, proof },
        };
      },
    },
    {
      label: "Submit it as a delete_account request",
      run: async (state) => {
        const result = await verifyProof1({
          attestationId: state.agent!.attestationId,
          proof: state.proof!,
          nonce: state.nonce!,
          serverId: "admin-mcp-server",
          requestedScope: { action: "delete_account" },
        });
        return {
          result: {
            label: "Submit it as a delete_account request",
            narration: result.valid
              ? "VULNERABLE — should never happen"
              : `REJECTED — ${result.reason}. The attestation's real scope (issue_refund) never matches what's being requested.`,
            response: result,
            blocked: !result.valid,
          },
          newState: state,
        };
      },
    },
  ],
};