import { AttackDefinition } from "./types";
import { ADMIN_URL, registerAgent, getNonce } from "@zk-mcp/attack-scripts";
import { generateProof } from "@zk-mcp/sigma-core";

interface State {
  agent?: { secretKey: string; publicKey: string; attestationId: string };
  nonce?: string;
  proof?: { R: string; s: string };
}

export const crossServerReuseAttack: AttackDefinition<State> = {
  id: "5",
  title: "Cross-Server Credential Reuse",
  initialState: {},
  steps: [
    {
      label: "Register agent with delete_account scope",
      run: async (state) => {
        const agent = await registerAgent("attacker-cross-server-demo", { action: "delete_account" });
        return {
          result: {
            label: "Register agent with delete_account scope",
            narration: "A genuinely valid delete_account credential — that part is legitimate.",
            response: { attestationId: agent.attestationId },
          },
          newState: { ...state, agent },
        };
      },
    },
    {
      label: "Request a nonce genuinely issued for admin-mcp-server",
      run: async (state) => {
        const nonce = await getNonce("delete_account", "admin-mcp-server");
        return {
          result: {
            label: "Request a nonce genuinely issued for admin-mcp-server",
            narration: "This nonce is real and correctly scoped to the server we're about to attack.",
            response: { nonce },
          },
          newState: { ...state, nonce },
        };
      },
    },
    {
      label: "Sign the proof but bind it to finance-mcp-server instead",
      run: async (state) => {
        const proof = generateProof(state.agent!.secretKey, state.agent!.publicKey, {
          scope: "delete_account",
          nonce: state.nonce!,
          serverId: "finance-mcp-server",
        });
        return {
          result: {
            label: "Sign the proof but bind it to finance-mcp-server instead",
            narration:
              "serverId is baked directly into the Fiat-Shamir challenge hash — this proof is mathematically bound to the wrong server.",
            response: proof,
          },
          newState: { ...state, proof },
        };
      },
    },
    {
      label: "Submit to the REAL live admin-mcp-server",
      run: async (state) => {
        const mcpRes = await fetch(`${ADMIN_URL}/mcp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "delete_account",
              arguments: {
                agentId: "attacker-cross-server-demo",
                attestationId: state.agent!.attestationId,
                requestedScope: { action: "delete_account" },
                sigmaProof: state.proof,
                nonce: state.nonce,
                accountRef: "acct-002",
                claimedAccountIdSalt: "1",
                complianceProof: { proof: {}, publicSignals: ["0", "0", "0"] },
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
            label: "Submit to the REAL live admin-mcp-server",
            narration: blocked
              ? `REJECTED by the real running admin-mcp-server — ${resultBody.reason}`
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