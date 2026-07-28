import { AttackDefinition } from "./types";
import { ISSUER_URL, registerAgent } from "@zk-mcp/attack-scripts";
import { generateKeyPair } from "@zk-mcp/sigma-core";

interface State {
  agentA?: { attestationId: string };
  agentBAttestationId?: string;
}

export const escalationAttack: AttackDefinition<State> = {
  id: "3",
  title: "Privilege Escalation via Delegation",
  initialState: {},
  steps: [
    {
      label: "Register Agent A with a $100 limit",
      run: async (state) => {
        const agentA = await registerAgent("attacker-parent-A-demo", { action: "issue_refund", limit: 100 });
        return {
          result: {
            label: "Register Agent A with a $100 limit",
            narration: "The root attacker credential holds a modest $100 refund ceiling.",
            response: { attestationId: agentA.attestationId },
          },
          newState: { ...state, agentA },
        };
      },
    },
    {
      label: "Agent A delegates $50 to Agent B",
      run: async (state) => {
        const { publicKey } = generateKeyPair();
        const res = await fetch(`${ISSUER_URL}/delegate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentAttestationId: state.agentA!.attestationId,
            childAgentId: "attacker-child-B-demo",
            childPublicKey: publicKey,
            requestedScope: { action: "issue_refund", limit: 50 },
            expirySeconds: 3600,
          }),
        });
        const body = await res.json();
        return {
          result: {
            label: "Agent A delegates $50 to Agent B",
            narration: "A legitimate, narrower delegation — $50 is a subset of A's $100.",
            response: body,
          },
          newState: { ...state, agentBAttestationId: body.attestation?.id },
        };
      },
    },
    {
      label: "Agent B (holding $50) tries to delegate $50,000 to Agent C",
      run: async (state) => {
        const { publicKey } = generateKeyPair();
        const res = await fetch(`${ISSUER_URL}/delegate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentAttestationId: state.agentBAttestationId,
            childAgentId: "attacker-grandchild-C-demo",
            childPublicKey: publicKey,
            requestedScope: { action: "issue_refund", limit: 50000 },
            expirySeconds: 3600,
          }),
        });
        const body = await res.json();
        return {
          result: {
            label: "Agent B (holding $50) tries to delegate $50,000 to Agent C",
            narration: res.ok
              ? "VULNERABLE — should never happen"
              : `REJECTED — ${body.reason}. B never held $50,000 to give away in the first place.`,
            response: body,
            blocked: !res.ok,
          },
          newState: state,
        };
      },
    },
  ],
};