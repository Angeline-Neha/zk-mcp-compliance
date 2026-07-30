import { generateKeyPair } from "@zk-mcp/sigma-core";
import fs from "fs";
import path from "path";

const ISSUER_SERVICE_URL = process.env.ISSUER_SERVICE_URL ?? "http://localhost:4001";
const AGENT_ID = "support-agent";
const KEYPAIR_PATH = path.join(__dirname, "..", ".agent-identity.json");

interface AgentIdentity {
  secretKey: string;
  publicKey: string;
  attestationId: string;
}

/**
 * Loads this agent's persistent identity, generating and registering a
 * fresh one on first run. A real agent's keypair must be stable across
 * restarts (the attestation registered with issuer-service is bound to a
 * specific public key) — regenerating it every boot would orphan any
 * previously-issued attestation.
 *
 * NOTE: for the demo, this agent self-registers with a scope/limit taken
 * from env vars. In the full spec architecture, this scope would instead
 * come from a delegation minted by orchestrator-agent (Stage 2) — that
 * wiring is what orchestrator-agent adds on top of this.
 */
export async function loadOrCreateIdentity(): Promise<AgentIdentity> {
  if (fs.existsSync(KEYPAIR_PATH)) {
    return JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
  }

  const { secretKey, publicKey } = generateKeyPair();
  const limit = Number(process.env.SUPPORT_AGENT_REFUND_LIMIT ?? 500);

  const res = await fetch(`${ISSUER_SERVICE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: AGENT_ID,
      publicKey,
      scope: { action: "issue_refund", limit },
      expirySeconds: 30 * 24 * 3600, // 30 days
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to register support-agent identity: ${res.status} ${await res.text()}`);
  }
  const { attestation } = await res.json();

  const identity: AgentIdentity = { secretKey, publicKey, attestationId: attestation.id };
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(identity, null, 2));
  console.log(`support-agent registered fresh identity, attestationId=${attestation.id}`);
  return identity;
}

export { AGENT_ID, ISSUER_SERVICE_URL };