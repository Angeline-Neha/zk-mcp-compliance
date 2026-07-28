import { AttackDefinition } from "./types";
import { registerAgent, getNonce, sigmaProof, verifyProof1 } from "@zk-mcp/attack-scripts";

interface State {
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  nonce?: string;
  proof?: { R: string; s: string };
}

export const replayAttack: AttackDefinition<State> = {
  id: "1",
  title: "Replay",
  initialState: {},
  steps: [
    {
      label: "Register attacker agent",
      run: async (state) => {
        const agent = await registerAgent("attacker-replay-demo", { action: "issue_refund", limit: 500 });
        return {
          result: {
            label: "Register attacker agent",
            narration: "The attacker registers a legitimate refund-scoped credential — nothing suspicious yet.",
            request: { agentId: "attacker-replay-demo", scope: { action: "issue_refund", limit: 500 } },
            response: { attestationId: agent.attestationId, publicKey: agent.publicKey },
          },
          newState: { ...state, agent },
        };
      },
    },
    {
      label: "Request a nonce",
      run: async (state) => {
        const nonce = await getNonce("issue_refund", "finance-mcp-server");
        return {
          result: {
            label: "Request a nonce",
            narration: "A fresh, single-use nonce is issued, valid for 60 seconds.",
            request: { scope: "issue_refund", serverId: "finance-mcp-server" },
            response: { nonce },
          },
          newState: { ...state, nonce },
        };
      },
    },
    {
      label: "Sign a valid proof",
      run: async (state) => {
        const proof = await sigmaProof(state.agent!.secretKey, state.agent!.publicKey, {
          scope: "issue_refund",
          nonce: state.nonce!,
          serverId: "finance-mcp-server",
        });
        return {
          result: {
            label: "Sign a valid proof",
            narration: "The attacker computes a genuinely valid Schnorr proof for this nonce.",
            response: proof,
          },
          newState: { ...state, proof },
        };
      },
    },
    {
      label: "Submit it, then submit it again",
      run: async (state) => {
        const verifyArgs = {
          attestationId: state.agent!.attestationId,
          proof: state.proof!,
          nonce: state.nonce!,
          serverId: "finance-mcp-server",
          requestedScope: { action: "issue_refund", limit: 500 },
        };
        const first = await verifyProof1(verifyArgs);
        const second = await verifyProof1(verifyArgs);
        return {
          result: {
            label: "Submit it, then submit it again",
            narration: second.valid
              ? "VULNERABLE — should never happen"
              : `First submission: VALID. Second submission of the SAME proof: REJECTED — ${second.reason}`,
            response: { firstAttempt: first, secondAttempt: second },
            blocked: !second.valid,
          },
          newState: state,
        };
      },
    },
  ],
};