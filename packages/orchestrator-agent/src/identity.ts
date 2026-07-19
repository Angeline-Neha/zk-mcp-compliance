import { generateKeyPair } from "@zk-mcp/sigma-core";
import fs from "fs";
import path from "path";

const ISSUER_SERVICE_URL = process.env.ISSUER_SERVICE_URL ?? "http://localhost:4001";
const AGENT_ID = "orchestrator-agent";
const KEYPAIR_PATH = path.join(__dirname, "..", ".agent-identity.json");

interface AgentIdentity {
  secretKey: string;
  publicKey: string;
  attestationId: string;
}

/**
 * orchestrator-agent holds the BROADEST attestation in the system (per
 * spec Section 6: "Holds the broadest attestation"). It doesn't call
 * issue_refund itself — it only ever delegates a NARROWER scope to
 * support-agent, which issuer-service's subset-check enforces server-side
 * regardless of what orchestrator claims it's delegating.
 */
export async function loadOrCreateIdentity(): Promise<AgentIdentity> {
  if (fs.existsSync(KEYPAIR_PATH)) {
    return JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
  }

  const { secretKey, publicKey } = generateKeyPair();
  const limit = Number(process.env.ORCHESTRATOR_REFUND_LIMIT_CEILING ?? 10000);

  const res = await fetch(`${ISSUER_SERVICE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: AGENT_ID,
      publicKey,
      scope: { action: "issue_refund", limit },
      expirySeconds: 30 * 24 * 3600,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to register orchestrator-agent identity: ${res.status} ${await res.text()}`);
  }
  const { attestation } = await res.json();

  const identity: AgentIdentity = { secretKey, publicKey, attestationId: attestation.id };
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(identity, null, 2));
  console.log(`orchestrator-agent registered fresh identity, attestationId=${attestation.id}`);
  return identity;
}

export { AGENT_ID, ISSUER_SERVICE_URL };