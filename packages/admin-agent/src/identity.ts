import { generateKeyPair } from "@zk-mcp/sigma-core";
import fs from "fs";
import path from "path";

const ISSUER_SERVICE_URL = process.env.ISSUER_SERVICE_URL ?? "http://localhost:4001";
const AGENT_ID = "admin-agent";
const KEYPAIR_PATH = path.join(__dirname, "..", ".agent-identity.json");

interface AgentIdentity {
  secretKey: string;
  publicKey: string;
  attestationId: string;
}

export async function loadOrCreateIdentity(): Promise<AgentIdentity> {
  if (fs.existsSync(KEYPAIR_PATH)) {
    return JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
  }

  const { secretKey, publicKey } = generateKeyPair();

  const res = await fetch(`${ISSUER_SERVICE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: AGENT_ID,
      publicKey,
      scope: { action: "delete_account" },
      expirySeconds: 30 * 24 * 3600,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to register admin-agent identity: ${res.status} ${await res.text()}`);
  }
  const { attestation } = await res.json();

  const identity: AgentIdentity = { secretKey, publicKey, attestationId: attestation.id };
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(identity, null, 2));
  console.log(`admin-agent registered fresh identity, attestationId=${attestation.id}`);
  return identity;
}

export { AGENT_ID, ISSUER_SERVICE_URL };