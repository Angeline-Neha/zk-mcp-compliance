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
  /** Attack 8: the session that produced the authenticated intent commitment. */
  sessionId?: string;
  /**
   * Attack 8: the SHA-256 hex commitment hash returned by POST /intent-commitment.
   * Must match what was bound into the Fiat-Shamir challenge for Proof 1 — if
   * the agent used a different hash when generating its sigma proof, the
   * algebraic check in /verify will fail before we even reach this gate.
   */
  intentCommitmentHash?: string;
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
  proof1Valid: boolean;
  proof2Valid: boolean;
  intentBindingFail?: boolean;
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
  intentBindingFail?: boolean;
  sessionId?: string;
}): Promise<void> {
  await fetch(`${ISSUER_SERVICE_URL}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: entry.agentId,
      scopeAction: entry.scopeAction,
      toolName: entry.toolName,
      proof1Hash: entry.proof1Hash,
      proof2Hash: entry.proof2Hash,
      pass: entry.pass,
      reason: entry.reason,
      policyCommitment: entry.policyCommitment,
      intentBindingFail: entry.intentBindingFail ?? false,
      sessionId: entry.sessionId ?? null,
    }),
  });
}

/**
 * Intent-binding gate check (Attack 8).
 *
 * Runs AFTER Proof 1 passes, BEFORE Proof 2 is called.
 *
 * Three independent sub-checks — any single failure blocks the action:
 *   1. orderRef is in the authenticated intent commitment for this session
 *      (not just "a valid order", but specifically the one the real customer
 *      authorised pre-LLM)
 *   2. Action count is below expectedActionCount
 *      (blocks salami-slicing: one authorised request → multiple actions)
 *
 * On pass: atomically increments the session action counter so subsequent
 * calls within the same session are still counted.
 *
 * When sessionId or intentCommitmentHash are absent (e.g. attacks 1–7
 * scripts, any pre-Phase-8 caller), this function returns { ok: true }
 * immediately — fully backward-compatible.
 */
async function verifyIntentBinding(
  orderRef: string,
  sessionId: string | undefined,
  intentCommitmentHash: string | undefined
): Promise<{ ok: boolean; reason?: string }> {
  if (!sessionId || !intentCommitmentHash) {
    // No intent commitment provided — caller predates Attack 8 extension.
    // Backward-compatible pass-through; attacks 1–7 are unaffected.
    return { ok: true };
  }

  const commitmentRes = await fetch(
    `${ISSUER_SERVICE_URL}/intent-commitment/${encodeURIComponent(sessionId)}`
  );

  if (commitmentRes.status === 404) {
    return {
      ok: false,
      reason: "INTENT_BINDING_FAIL: no intent commitment found for this session — cannot verify request provenance",
    };
  }
  if (commitmentRes.status === 410) {
    return {
      ok: false,
      reason: "INTENT_BINDING_FAIL: intent commitment has expired",
    };
  }
  if (!commitmentRes.ok) {
    return {
      ok: false,
      reason: `INTENT_BINDING_FAIL: intent commitment lookup failed (${commitmentRes.status})`,
    };
  }

  const commitment = await commitmentRes.json();

  // Sub-check 1: orderRef must be in the authenticated set
  if (!(commitment.orderRefs as string[]).includes(orderRef)) {
    return {
      ok: false,
      reason: `INTENT_BINDING_FAIL: orderRef "${orderRef}" was not in the authenticated intent ` +
        `(authenticated: [${commitment.orderRefs.join(", ")}]) — possible injected instruction`,
    };
  }

  // Sub-check 2: commitment hash in the proof must match stored hash
  // (belt-and-suspenders: the Fiat-Shamir algebra already enforces this
  //  cryptographically, but an explicit equality check here catches any
  //  inconsistency before Proof 2 runs and produces a clear audit reason)
  if (intentCommitmentHash !== commitment.commitmentHash) {
    return {
      ok: false,
      reason: "INTENT_BINDING_FAIL: intentCommitmentHash in request does not match stored commitment",
    };
  }

  // Sub-check 3: action count cap (salami-slicing prevention)
  if (commitment.actionCount >= commitment.expectedActionCount) {
    return {
      ok: false,
      reason: `INTENT_BINDING_FAIL: action count (${commitment.actionCount}) has reached the ` +
        `authorised limit (${commitment.expectedActionCount}) — possible salami-slicing attempt`,
    };
  }

  // All checks passed — atomically increment counter before proceeding to Proof 2
  await fetch(
    `${ISSUER_SERVICE_URL}/intent-action-increment/${encodeURIComponent(sessionId)}`,
    { method: "POST" }
  );

  return { ok: true };
}

/**
 * The two-proof gate — now extended with an intent-binding check (Attack 8).
 *
 * Full check order:
 *   Proof 1 (sigma, authorization)
 *   → Intent Binding (logged as its own event class if it fails)
 *   → DEMO_DISABLE_PROOF_2 kill-switch
 *   → Proof 2 (Groth16, compliance)
 *   → registered-commitment check
 *   → approved signal check
 *   → amount-binding check
 *
 * BOTH cryptographic proofs must independently pass, plus the intent-binding
 * check and two additional checks that close gaps the raw proofs alone don't
 * cover:
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
      sessionId: input.sessionId,
    });
    return {
      allowed: false,
      reason: `Proof 1 (authorization) failed: ${proof1Body.reason}`,
      proof1Valid: false,
      proof2Valid: false,
    };
  }

  // ---- Intent Binding check (Attack 8) ------------------------------------
  // Runs after Proof 1 so we know the calling agent is legitimately scoped.
  // Runs before Proof 2 so we don't waste proving-service calls on injected
  // requests. Failure is logged as its own distinct event class.
  const orderRef = (input as any).orderRef as string | undefined;
  const intentCheck = await verifyIntentBinding(
    orderRef ?? "",
    input.sessionId,
    input.intentCommitmentHash
  );
  if (!intentCheck.ok) {
    await logAudit({
      agentId: input.agentId,
      scopeAction: input.requestedScope.action,
      toolName: input.toolName,
      proof1Hash,
      proof2Hash: null,
      pass: false,
      reason: intentCheck.reason ?? "intent binding failed",
      policyCommitment: null,
      intentBindingFail: true,
      sessionId: input.sessionId,
    });
    return {
      allowed: false,
      reason: intentCheck.reason,
      proof1Valid: true,
      proof2Valid: false,
      intentBindingFail: true,
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
      sessionId: input.sessionId,
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
      sessionId: input.sessionId,
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
      sessionId: input.sessionId,
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
      sessionId: input.sessionId,
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
      sessionId: input.sessionId,
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
      sessionId: input.sessionId,
    });
    return {
      allowed: false,
      reason: "amount-binding mismatch — executed amount does not match proven amount",
      proof1Valid: true,
      proof2Valid: true,
    };
  }

  // ---- all checks pass ----
  await logAudit({
    agentId: input.agentId,
    scopeAction: input.requestedScope.action,
    toolName: input.toolName,
    proof1Hash,
    proof2Hash,
    pass: true,
    reason: null,
    policyCommitment: registeredCommitment,
    sessionId: input.sessionId,
  });

  return { allowed: true, proof1Valid: true, proof2Valid: true };
}
