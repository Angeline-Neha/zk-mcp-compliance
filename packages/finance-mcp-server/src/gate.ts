import { createHash } from "crypto";
import { buildPoseidon } from "circomlibjs";

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
  requestedScope: { action: string; limit?: number };
  sigmaProof: SigmaProof;
  nonce: string;
  serverId: string;
  toolName: string;
  circuitId: string;
  complianceProof: ComplianceProof;
  claimedAmount: number;
  claimedAmountSalt: string;
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
  proof1Valid: boolean;
  proof2Valid: boolean;
}

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

/**
 * The two-proof gate. BOTH proofs must independently pass, plus two
 * additional checks that close gaps the raw proofs alone don't cover:
 *
 *  - the proof's claimed policyCommitment must match what's ACTUALLY
 *    registered with issuer-service (not just internally self-consistent
 *    with the circuit's own private inputs — see the comment in
 *    issuer-service's /policy-commitment route for why this matters)
 *  - the amount this call is about to execute must match the amount the
 *    circuit actually proved compliant (via the amountCommitment signal)
 *
 * Every outcome — pass or fail, and why — is written to the unified audit
 * log via issuer-service's /audit endpoint before this function returns.
 */
export async function runGate(input: GateInput): Promise<GateResult> {
  const proof1Hash = hashSigmaProof(input.sigmaProof);
  const proof2Hash = hashComplianceProof(input.complianceProof);

  // ---- Proof 1: authorization (sigma protocol), via issuer-service -------
  const proof1Res = await fetch(`${ISSUER_SERVICE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attestationId: input.attestationId,
      proof: input.sigmaProof,
      nonce: input.nonce,
      serverId: input.serverId,
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
    return {
      allowed: false,
      reason: `Proof 1 (authorization) failed: ${proof1Body.reason}`,
      proof1Valid: false,
      proof2Valid: false,
    };
  }

  // ---------------------------------------------------------------------
  // DEMO-ONLY: Proof 2 kill switch. When DEMO_DISABLE_PROOF_2=true, the
  // gate skips compliance verification entirely and allows through on
  // Proof 1 alone — for demonstrating what an identity/scope-only system
  // (e.g. plain OAuth/JWT-based MCP auth) would have allowed. Toggled via
  // env var so the NEXT request picks it up immediately — no code edit,
  // no service restart, no risk of a botched live edit mid-presentation.
  // NEVER set this in a real deployment; it exists only for the ablation
  // demo described in the frontend/demo plan.
  // ---------------------------------------------------------------------
  if (process.env.DEMO_DISABLE_PROOF_2 === "true") {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash: null,
      pass: true,
      reason: "DEMO MODE: Proof 2 was skipped (DEMO_DISABLE_PROOF_2=true) — identity/scope-only ablation",
      policyCommitment: null,
    });
    return { allowed: true, proof1Valid: true, proof2Valid: false };
  }

  // ---- Proof 2: compliance (Groth16), via compliance-proving-service -----
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
    return {
      allowed: false,
      reason: "Proof 2 (compliance) failed cryptographic verification",
      proof1Valid: true,
      proof2Valid: false,
    };
  }

  // signal order per refundPolicy.circom: [approved, amountCommitment, policyCommitment]
  const [approvedSignal, amountCommitmentSignal, claimedPolicyCommitment] =
    input.complianceProof.publicSignals;

  // ---- registered-commitment check: closes the "forge both together" gap ----
  const commitmentRes = await fetch(`${ISSUER_SERVICE_URL}/policy-commitment/${input.toolName}`);
  if (commitmentRes.status !== 200) {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash,
      pass: false,
      reason: "no policy commitment registered for this tool — cannot verify compliance proof",
      policyCommitment: null,
    });
    return {
      allowed: false,
      reason: "no policy commitment registered for this tool",
      proof1Valid: true,
      proof2Valid: true,
    };
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
    return {
      allowed: false,
      reason: "policyCommitment mismatch — proof does not use the registered policy",
      proof1Valid: true,
      proof2Valid: true,
    };
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
      reason: "compliance policy evaluated to APPROVE=false (escalate to human review)",
      policyCommitment: registeredCommitment,
    });
    return {
      allowed: false,
      reason: "compliance policy evaluated to APPROVE=false (escalate to human review)",
      proof1Valid: true,
      proof2Valid: true,
    };
  }

  // ---- amount-binding check: closes the "proved $50, executed $5000" gap ----
  const poseidon = await buildPoseidon();
  const hash = poseidon([input.claimedAmount, input.claimedAmountSalt]);
  const recomputedAmountCommitment = poseidon.F.toObject(hash).toString();

  if (recomputedAmountCommitment !== amountCommitmentSignal) {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash,
      pass: false,
      reason: "amount-binding mismatch — the amount about to be executed does not match the amount the proof covers",
      policyCommitment: registeredCommitment,
    });
    return {
      allowed: false,
      reason: "amount-binding mismatch — executed amount does not match proven amount",
      proof1Valid: true,
      proof2Valid: true,
    };
  }

  // ---- both proofs pass, commitment matches, amount is bound, approved ----
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

  return { allowed: true, proof1Valid: true, proof2Valid: true };
}
