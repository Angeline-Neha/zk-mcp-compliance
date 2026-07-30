import { generateProof } from "@zk-mcp/sigma-core";
import { buildPoseidon } from "circomlibjs";
import { randomBytes, createHash } from "crypto";
import { POLICY } from "./policyConfig";
import { ISSUER_SERVICE_URL } from "./identity";

const PROVING_SERVICE_URL = process.env.PROVING_SERVICE_URL ?? "http://localhost:4002";
const SERVER_ID = "admin-mcp-server";

export interface AccountContext {
  accountRef: string;
  consentGiven: boolean;
  daysSinceLastTransaction: number;
  hasActiveDependency: boolean;
}

function accountRefToFieldElement(accountRef: string): string {
  const hash = createHash("sha256").update(accountRef).digest();
  return BigInt("0x" + hash.subarray(0, 31).toString("hex")).toString();
}

async function realPolicyCommitment(): Promise<string> {
  const poseidon = await buildPoseidon();
  const hash = poseidon([POLICY.retentionFloorDays, POLICY.policyLimitSalt]);
  return poseidon.F.toObject(hash).toString();
}

export async function assembleDeletionProofs(
  identity: { secretKey: string; publicKey: string; attestationId: string },
  account: AccountContext
) {
  const nonceRes = await fetch(`${ISSUER_SERVICE_URL}/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "delete_account", serverId: SERVER_ID }),
  });
  const { nonce } = await nonceRes.json();

  const sigmaProof = generateProof(identity.secretKey, identity.publicKey, {
    scope: "delete_account",
    nonce,
    serverId: SERVER_ID,
  });

  const policyCommitment = await realPolicyCommitment();
  const accountIdSalt = BigInt("0x" + randomBytes(16).toString("hex")).toString();

  const proveRes = await fetch(`${PROVING_SERVICE_URL}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      circuitId: "deletionPolicy",
      input: {
        consentGiven: account.consentGiven ? "1" : "0",
        daysSinceLastTransaction: account.daysSinceLastTransaction.toString(),
        hasActiveDependency: account.hasActiveDependency ? "1" : "0",
        retentionFloorDays: POLICY.retentionFloorDays.toString(),
        policyLimitSalt: POLICY.policyLimitSalt,
        policyCommitment,
        accountId: accountRefToFieldElement(account.accountRef),
        accountIdSalt,
      },
    }),
  });

  if (!proveRes.ok) {
    const body = await proveRes.json();
    throw new Error(`Compliance proof generation failed: ${body.error ?? proveRes.statusText}`);
  }

  const { proof, publicSignals } = await proveRes.json();

  return {
    sigmaProof,
    nonce,
    complianceProof: { proof, publicSignals },
    claimedAccountIdSalt: accountIdSalt,
  };
}