import { createHash } from "crypto";

const ISSUER_SERVICE_URL = process.env.ISSUER_SERVICE_URL ?? "http://localhost:4001";
const PROVING_SERVICE_URL = process.env.PROVING_SERVICE_URL ?? "http://localhost:4002";

export interface SigmaProof {
  R: string;
  s: string;
}

export interface ComplianceProof {
  proof: unknown;
  publicSignals: string[];
}

export interface GateInput {
  agentId: string;
  attestationId: string;
  requestedScope: { action: string };
  sigmaProof: SigmaProof;
  nonce: string;
  toolName: string;
  circuitId: string;
  complianceProof: ComplianceProof;
  claimedAccountId: string;
  claimedAccountIdSalt: string;
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
}

const SERVER_ID = "admin-mcp-server";

function hashSigmaProof(proof: SigmaProof): string {
  return createHash("sha256").update(proof.R + proof.s).digest("hex");
}

function hashComplianceProof(proof: ComplianceProof): string {
  return createHash("sha256").update(JSON.stringify(proof.proof)).digest("hex");
}

async function logAudit(entry: {
  agentId: string;
  scopeAction: string;
  toolName: string;
  proof1Hash: string | null;
  proof2Hash: string | null;
  pass: boolean;
  reason: string | null;
  policyCommitment: string | null;
}): Promise<void> {
  await fetch(`${ISSUER_SERVICE_URL}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

async function poseidonHash(inputs: (string | number)[]): Promise<string> {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const hash = poseidon(inputs);
  return poseidon.F.toObject(hash).toString();
}

/**
 * Full two-proof gate for delete_account — same pattern and same closed
 * gaps as finance-mcp-server's gate.ts:
 *   - registered-commitment check (not just circuit-internal consistency)
 *   - accountId-binding check (equivalent to finance's amount-binding:
 *     binds "the account actually proven compliant" to "the account
 *     about to be deleted")
 */
export async function runGate(input: GateInput): Promise<GateResult> {
  const proof1Hash = hashSigmaProof(input.sigmaProof);
  const proof2Hash = hashComplianceProof(input.complianceProof);

  // ---- Proof 1: authorization ----
  const proof1Res = await fetch(`${ISSUER_SERVICE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attestationId: input.attestationId,
      proof: input.sigmaProof,
      nonce: input.nonce,
      serverId: SERVER_ID,
      requestedScope: input.requestedScope,
    }),
  });
  const proof1Body = await proof1Res.json();

  if (!proof1Body.valid) {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash: null,
      pass: false,
      reason: `Proof 1 (authorization) failed: ${proof1Body.reason}`,
      policyCommitment: null,
    });
    return { allowed: false, reason: `Proof 1 (authorization) failed: ${proof1Body.reason}` };
  }

  // ---- Proof 2: compliance ----
  const proof2Res = await fetch(`${PROVING_SERVICE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      circuitId: input.circuitId,
      proof: input.complianceProof.proof,
      publicSignals: input.complianceProof.publicSignals,
    }),
  });
  const proof2Body = await proof2Res.json();

  if (!proof2Body.valid) {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash,
      pass: false,
      reason: "Proof 2 (compliance) failed cryptographic verification",
      policyCommitment: null,
    });
    return { allowed: false, reason: "Proof 2 (compliance) failed cryptographic verification" };
  }

  // signal order per deletionPolicy.circom: [approved, accountIdCommitment, policyCommitment]
  const [approvedSignal, accountIdCommitmentSignal, claimedPolicyCommitment] =
    input.complianceProof.publicSignals;

  // ---- registered-commitment check ----
  const commitmentRes = await fetch(`${ISSUER_SERVICE_URL}/policy-commitment/${input.toolName}`);
  if (commitmentRes.status !== 200) {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash,
      pass: false,
      reason: "no policy commitment registered for this tool",
      policyCommitment: null,
    });
    return { allowed: false, reason: "no policy commitment registered for this tool" };
  }
  const { commitmentHex: registeredCommitment } = await commitmentRes.json();

  if (claimedPolicyCommitment !== registeredCommitment) {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash,
      pass: false,
      reason: "policyCommitment mismatch — proof does not use the registered policy",
      policyCommitment: claimedPolicyCommitment,
    });
    return { allowed: false, reason: "policyCommitment mismatch — proof does not use the registered policy" };
  }

  // ---- approved check ----
  if (approvedSignal !== "1") {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash,
      pass: false,
      reason: "compliance policy evaluated to APPROVE=false — deletion blocked",
      policyCommitment: registeredCommitment,
    });
    return { allowed: false, reason: "compliance policy evaluated to APPROVE=false — deletion blocked" };
  }

  // ---- account-id binding check ----
  const recomputedAccountIdCommitment = await poseidonHash([
    input.claimedAccountId,
    input.claimedAccountIdSalt,
  ]);

  if (recomputedAccountIdCommitment !== accountIdCommitmentSignal) {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash,
      pass: false,
      reason: "account-binding mismatch — the account about to be deleted does not match the account the proof covers",
      policyCommitment: registeredCommitment,
    });
    return { allowed: false, reason: "account-binding mismatch — executed account does not match proven account" };
  }

  await logAudit({
    agentId: input.agentId,
    scopeAction: input.requestedScope.action,
    toolName: input.toolName,
    proof1Hash,
    proof2Hash,
    pass: true,
    reason: null,
    policyCommitment: registeredCommitment,
  });

  return { allowed: true };
}

export { SERVER_ID };