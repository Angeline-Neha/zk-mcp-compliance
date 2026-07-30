import { AttackDefinition } from "./types";
import { getNonce, verifyProof1 } from "@zk-mcp/attack-scripts";
import { generateKeyPair, generateProof } from "@zk-mcp/sigma-core";
import { randomUUID } from "crypto";

interface State {
  secretKey?: string;
  publicKey?: string;
  nonce?: string;
  proof?: { R: string; s: string };
}

export const lateralMovementAttack: AttackDefinition<State> = {
  id: "4",
  title: "Lateral Movement",
  initialState: {},
  steps: [
    {
      label: "Generate a keypair — NO registration at all",
      run: async (state) => {
        const { secretKey, publicKey } = generateKeyPair();
        return {
          result: {
            label: "Generate a keypair — NO registration at all",
            narration: "This identity was never registered with issuer-service — no attestation exists for it, for any scope.",
            response: { publicKey },
          },
          newState: { ...state, secretKey, publicKey },
        };
      },
    },
    {
      label: "Sign a proof claiming delete_account scope anyway",
      run: async (state) => {
        const nonce = await getNonce("delete_account", "admin-mcp-server");
        const proof = generateProof(state.secretKey!, state.publicKey!, {
          scope: "delete_account",
          nonce,
          serverId: "admin-mcp-server",
        });
        return {
          result: {
            label: "Sign a proof claiming delete_account scope anyway",
            narration: "The math is fine — a valid signature over this unregistered key. But no attestation exists to back it.",
            response: { nonce, proof },
          },
          newState: { ...state, nonce, proof },
        };
      },
    },
    {
      label: "Submit with a fabricated attestationId",
      run: async (state) => {
        const fakeAttestationId = randomUUID();
        const result = await verifyProof1({
          attestationId: fakeAttestationId,
          proof: state.proof!,
          nonce: state.nonce!,
          serverId: "admin-mcp-server",
          requestedScope: { action: "delete_account" },
        });
        return {
          result: {
            label: "Submit with a fabricated attestationId",
            narration: result.valid
              ? "VULNERABLE — should never happen"
              : `REJECTED — ${result.reason}. This is checked before scope is even compared: no such attestation exists.`,
            response: result,
            blocked: !result.valid,
          },
          newState: state,
        };
      },
    },
  ],
};