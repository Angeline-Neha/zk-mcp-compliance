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

/**
 * Mirrors finance-mcp-server's GateInspectorDetail (see that file for the
 * refund-side equivalent). No intentCheck section here — intent-binding is
 * a refund-flow-only extension (Attack 8), delete_account doesn't have one.
 */
export interface GateInspectorDetail {
  proof1: {
    R: string;
    s: string;
    c: string;
    publicKey: string;
    scope: string;
    nonce: string;
    serverId: string;
    checks: {
      algebra: { ok: boolean; detail: string };
      nonce: { ok: boolean; detail: string; ttlMs?: number };
      scope: { ok: boolean; detail: string };
      revocation: { ok: boolean; detail: string };
    };
  };
  proof2?: {
    circuitId: string;
    timingMs: number;
    proofSizeBytes: number;
    approved: boolean;
    policyCommitment?: string;
    toolScope: string;
    constraints: { name: string; ok: boolean }[];
  };
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
  proof1Valid: boolean;
  proof2Valid: boolean;
  inspector?: GateInspectorDetail;
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
  const { buildPoseidon } = require("circomlibjs");
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

  const inspector: GateInspectorDetail = {
    proof1: {
      R: input.sigmaProof.R,
      s: input.sigmaProof.s,
      c: proof1Body.proof1?.c ?? "",
      publicKey: proof1Body.proof1?.publicKey ?? "",
      scope: input.requestedScope.action,
      nonce: input.nonce,
      serverId: SERVER_ID,
      checks: {
        algebra: {
          ok: proof1Body.checks?.algebra?.ok ?? false,
          detail: proof1Body.checks?.algebra?.detail ?? "pending",
        },
        nonce: {
          ok: proof1Body.checks?.nonce?.ok ?? false,
          detail: proof1Body.checks?.nonce?.detail ?? "pending",
          ttlMs: proof1Body.checks?.nonce?.ttlMs,
        },
        scope: {
          ok: proof1Body.checks?.scope?.ok ?? false,
          detail: proof1Body.checks?.scope?.detail ?? "pending",
        },
        revocation: {
          ok: proof1Body.checks?.revocation?.ok ?? false,
          detail: proof1Body.checks?.revocation?.detail ?? "pending",
        },
      },
    },
  };

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
    return {
      allowed: false,
      reason: `Proof 1 (authorization) failed: ${proof1Body.reason}`,
      proof1Valid: false,
      proof2Valid: false,
      inspector,
    };
  }

  const proof2Base = {
    circuitId: input.circuitId,
    timingMs: 0,
    proofSizeBytes: JSON.stringify(input.complianceProof.proof).length,
    toolScope: input.toolName,
  };

  function attachProof2(approved: boolean, policyCommitment?: string | null, failReason?: string | null) {
    const constraints = [
      { name: "Poseidon", ok: approved || !failReason?.includes("policyCommitment") },
      { name: "LessEqThan", ok: approved || !failReason?.includes("APPROVE") },
      { name: "GreaterEqThan", ok: approved || !failReason?.includes("account-binding") },
    ];
    if (approved) constraints.forEach((c) => { c.ok = true; });
    inspector.proof2 = {
      ...proof2Base,
      approved,
      policyCommitment: policyCommitment ?? undefined,
      constraints,
    };
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
    attachProof2(false, null, "cryptographic verification failed");
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
    return {
      allowed: false,
      reason: "Proof 2 (compliance) failed cryptographic verification",
      proof1Valid: true,
      proof2Valid: false,
      inspector,
    };
  }

  // signal order per deletionPolicy.circom: [approved, accountIdCommitment, policyCommitment]
  const [approvedSignal, accountIdCommitmentSignal, claimedPolicyCommitment] =
    input.complianceProof.publicSignals;

  // ---- registered-commitment check ----
  const commitmentRes = await fetch(`${ISSUER_SERVICE_URL}/policy-commitment/${input.toolName}`);
  if (commitmentRes.status !== 200) {
    attachProof2(false, null, "policyCommitment mismatch");
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
    return {
      allowed: false,
      reason: "no policy commitment registered for this tool",
      proof1Valid: true,
      proof2Valid: false,
      inspector,
    };
  }
  const { commitmentHex: registeredCommitment } = await commitmentRes.json();

  if (claimedPolicyCommitment !== registeredCommitment) {
    attachProof2(false, claimedPolicyCommitment, "policyCommitment mismatch");
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
    return {
      allowed: false,
      reason: "policyCommitment mismatch — proof does not use the registered policy",
      proof1Valid: true,
      proof2Valid: false,
      inspector,
    };
  }

  // ---- approved check ----
  if (approvedSignal !== "1") {
    attachProof2(false, registeredCommitment, "compliance policy evaluated to APPROVE=false");
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
    return {
      allowed: false,
      reason: "compliance policy evaluated to APPROVE=false — deletion blocked",
      proof1Valid: true,
      proof2Valid: false,
      inspector,
    };
  }

  // ---- account-id binding check ----
  const recomputedAccountIdCommitment = await poseidonHash([
    input.claimedAccountId,
    input.claimedAccountIdSalt,
  ]);

  if (recomputedAccountIdCommitment !== accountIdCommitmentSignal) {
    attachProof2(false, registeredCommitment, "account-binding mismatch");
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
    return {
      allowed: false,
      reason: "account-binding mismatch — executed account does not match proven account",
      proof1Valid: true,
      proof2Valid: false,
      inspector,
    };
  }

  attachProof2(true, registeredCommitment, null);

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

  return { allowed: true, proof1Valid: true, proof2Valid: true, inspector };
}

export { SERVER_ID };
