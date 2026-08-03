import express, { Request, Response } from "express";
import { Express } from "express";
import { z } from "zod";
import { verifyProof, computeChallenge } from "@zk-mcp/sigma-core";
import {
  registerAttestation,
  delegateAttestation,
  revokeAttestation,
  getAttestation,
  isExpired,
  isRevoked,
  verifyChainNarrows,
  DelegationRejectedError,
} from "./attestations";
import { issueNonce, checkAndBurnNonce, peekNonceTtlMs } from "./nonceStore";
import { pool } from "./db";

export const app: Express = express();
app.use(express.json());
app.use(require("cors")());

const scopeSchema = z.object({
  action: z.string().min(1),
  limit: z.number().optional(),
});

// ---------------------------------------------------------------------------
// POST /register — Stage 1 of the spec. Agent generates a sigma keypair
// locally, sends the public commitment + requested scope; Issuer signs
// (here: persists) an attestation.
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  agentId: z.string().min(1),
  publicKey: z.string().min(1),
  scope: scopeSchema,
  expirySeconds: z.number().positive().default(3600),
});

app.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const attestation = await registerAttestation(parsed.data);
  res.status(201).json({ attestation });
});

// ---------------------------------------------------------------------------
// POST /challenge — issue a fresh nonce bound to (scope, serverId), TTL 60s.
// ---------------------------------------------------------------------------
const challengeSchema = z.object({
  scope: z.string().min(1),
  serverId: z.string().min(1),
});

app.post("/challenge", async (req: Request, res: Response) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const { nonce, expiresAt } = await issueNonce(parsed.data.scope, parsed.data.serverId);
  res.status(201).json({ nonce, expiresAt });
});

// ---------------------------------------------------------------------------
// POST /delegate — mint a child attestation. Server-side subset-check only;
// never trusts the requesting agent's own claim about what it's allowed to
// delegate. This is what stops Attack #3 (privilege escalation).
// ---------------------------------------------------------------------------
const delegateSchema = z.object({
  parentAttestationId: z.string().uuid(),
  childAgentId: z.string().min(1),
  childPublicKey: z.string().min(1),
  requestedScope: scopeSchema,
  expirySeconds: z.number().positive().default(3600),
});

app.post("/delegate", async (req: Request, res: Response) => {
  const parsed = delegateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  try {
    const attestation = await delegateAttestation(parsed.data);
    res.status(201).json({ attestation });
  } catch (err) {
    if (err instanceof DelegationRejectedError) {
      return res.status(403).json({ error: "delegation rejected", reason: err.message });
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// POST /revoke — append a revocation record. Append-only: this table is
// never updated or deleted, only inserted into.
// ---------------------------------------------------------------------------
const revokeSchema = z.object({
  attestationId: z.string().uuid(),
  reason: z.string().min(1),
});

app.post("/revoke", async (req: Request, res: Response) => {
  const parsed = revokeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  try {
    await revokeAttestation(parsed.data.attestationId, parsed.data.reason);
    res.status(201).json({ revoked: true });
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /verify — the full Proof 1 verification checklist from spec Section 2
// step 3. Not one of the four endpoints literally named in the roadmap's
// Phase 2 bullet list, but required for Phase 4's gate ("verify Proof 1 via
// issuer-service") to have anything to call — added here deliberately so
// that dependency is real rather than assumed.
//
// Order matters: nonce is checked (and burned) FIRST and atomically, so a
// replay attempt fails fast before any other check runs — and because
// GETDEL is atomic, two concurrent requests with the same nonce can never
// both pass this step.
// ---------------------------------------------------------------------------
const verifySchema = z.object({
  attestationId: z.string().uuid(),
  proof: z.object({ R: z.string(), s: z.string() }),
  nonce: z.string().min(1),
  serverId: z.string().min(1),
  requestedScope: scopeSchema,
  intentCommitmentHash: z.string().optional(),
});

app.post("/verify", async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const { attestationId, proof, nonce, serverId, requestedScope, intentCommitmentHash } = parsed.data;

  const sigmaCtx = {
    scope: requestedScope.action,
    nonce,
    serverId,
    ...(intentCommitmentHash ? { intentCommitmentHash } : {}),
  };

  const checks: Record<string, { ok: boolean; detail: string; ttlMs?: number }> = {
    scope: { ok: false, detail: "pending" },
    revocation: { ok: false, detail: "pending" },
    nonce: { ok: false, detail: "pending" },
    algebra: { ok: false, detail: "pending" },
  };

  const attestation = await getAttestation(attestationId);
  if (!attestation) {
    checks.scope.detail = "attestation does not exist";
    return res.status(200).json({
      valid: false,
      reason: "attestation does not exist",
      checks,
      proof1: { R: proof.R, s: proof.s, c: "", publicKey: "" },
    });
  }

  const cHex = computeChallenge(proof.R, attestation.publicKey, sigmaCtx).toString(16).padStart(64, "0");
  const proof1 = { R: proof.R, s: proof.s, c: cHex, publicKey: attestation.publicKey };

  const scopeOk =
    attestation.scope.action === requestedScope.action &&
    !(
      attestation.scope.limit !== undefined &&
      requestedScope.limit !== undefined &&
      requestedScope.limit > attestation.scope.limit
    );
  checks.scope = {
    ok: scopeOk,
    detail: scopeOk
      ? `"${requestedScope.action}" matches`
      : `scope mismatch (expected ${attestation.scope.action})`,
  };

  const revoked = await isRevoked(attestation.id);
  const expired = await isExpired(attestation);
  checks.revocation = {
    ok: !revoked && !expired,
    detail: revoked
      ? "revoked (checked now)"
      : expired
        ? "attestation expired"
        : "not revoked (checked now)",
  };

  const ttlMs = await peekNonceTtlMs(requestedScope.action, serverId, nonce);
  const nonceOk = await checkAndBurnNonce(requestedScope.action, serverId, nonce);
  checks.nonce = {
    ok: nonceOk,
    detail: nonceOk
      ? `unburned, TTL ${ttlMs != null ? Math.round(ttlMs / 1000) : "?"}s remaining`
      : "already burned or expired",
    ...(ttlMs != null ? { ttlMs } : {}),
  };

  const sigmaValid = verifyProof(proof, attestation.publicKey, sigmaCtx);
  checks.algebra = {
    ok: sigmaValid,
    detail: sigmaValid ? "s·G == R + c·P" : "s·G != R + c·P",
  };

  if (!scopeOk) {
    return res.status(200).json({ valid: false, reason: "scope mismatch", checks, proof1 });
  }
  if (expired) {
    return res.status(200).json({ valid: false, reason: "attestation expired", checks, proof1 });
  }
  if (revoked) {
    return res.status(200).json({ valid: false, reason: "attestation revoked", checks, proof1 });
  }
  if (!(await verifyChainNarrows(attestation.id))) {
    return res.status(200).json({
      valid: false,
      reason: "delegation chain does not narrow",
      checks,
      proof1,
    });
  }
  if (!nonceOk) {
    return res.status(200).json({
      valid: false,
      reason: "nonce already burned or expired",
      checks,
      proof1,
    });
  }
  if (!sigmaValid) {
    return res.status(200).json({
      valid: false,
      reason: "sigma proof algebra failed (s·G != R + c·P)",
      checks,
      proof1,
    });
  }

  res.status(200).json({ valid: true, checks, proof1 });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// POST /policy-commitment, GET /policy-commitment/:toolScope
//
// Registers the REAL policy commitment for a tool (Stage 0 of the spec:
// "compute each policy's Poseidon commitment; register commitments with
// the Issuer"). This is what makes Attack #7 actually impossible rather
// than just circuit-internally-consistent: the circuit alone only proves
// "my private params hash to the public commitment I claimed" — it can't
// stop an attacker who forges BOTH the private params AND the public
// commitment together. Only a check against a value registered here,
// independently of anything the agent submits, closes that gap. The gate
// is expected to fetch this before trusting any proof's policyCommitment
// signal.
// ---------------------------------------------------------------------------
const policyCommitmentSchema = z.object({
  toolScope: z.string().min(1),
  commitmentHex: z.string().min(1),
});

app.post("/policy-commitment", async (req: Request, res: Response) => {
  const parsed = policyCommitmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const { toolScope, commitmentHex } = parsed.data;
  await pool.query(
    `INSERT INTO policy_commitments (tool_scope, commitment_hex)
     VALUES ($1, $2)
     ON CONFLICT (tool_scope) DO UPDATE SET commitment_hex = EXCLUDED.commitment_hex`,
    [toolScope, commitmentHex]
  );
  res.status(201).json({ registered: true });
});

app.get("/policy-commitment/:toolScope", async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT commitment_hex FROM policy_commitments WHERE tool_scope = $1`,
    [req.params.toolScope]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "no policy commitment registered for this tool scope" });
  }
  res.status(200).json({ toolScope: req.params.toolScope, commitmentHex: result.rows[0].commitment_hex });
});

// ---------------------------------------------------------------------------
// POST /audit — unified two-proof audit entry, written by a gate (e.g.
// finance-mcp-server) after BOTH proofs have been checked. Per spec
// Stage 7: "Log entry stores: timestamp, agentId, scope, both proof
// hashes, pass/fail, policy commitment used." Never accepts raw private
// inputs — hashes only.
// ---------------------------------------------------------------------------
const auditSchema = z.object({
  agentId: z.string().min(1),
  scopeAction: z.string().min(1),
  toolName: z.string().min(1),
  proof1Hash: z.string().nullable().optional(),
  proof2Hash: z.string().nullable().optional(),
  pass: z.boolean(),
  reason: z.string().nullable().optional(),
  policyCommitment: z.string().nullable().optional(),
});

app.post("/audit", async (req: Request, res: Response) => {
  const parsed = auditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const { agentId, scopeAction, toolName, proof1Hash, proof2Hash, pass, reason, policyCommitment } =
    parsed.data;

  await pool.query(
    `INSERT INTO audit_log (agent_id, scope_action, tool_name, proof1_hash, proof2_hash, pass, reason, policy_commitment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [agentId, scopeAction, toolName, proof1Hash ?? null, proof2Hash ?? null, pass, reason ?? null, policyCommitment ?? null]
  );

  res.status(201).json({ logged: true });
});
  // ---------------------------------------------------------------------------
// GET /audit-log — read back the live event stream. This is what powers
// spec Section 9's "Live event log" view: real-time stream of every proof
// attempt (agent, tool, which proof(s) passed/failed, timestamp). Never
// returns raw private inputs — only what was written by POST /audit
// (proof hashes, pass/fail, reason, policy commitment).
//
// Supports simple pagination via ?limit=N&before=<ISO timestamp>, newest
// first, for a frontend to poll or infinite-scroll against.
// ---------------------------------------------------------------------------

app.get("/attestations", async (_req: Request, res: Response) => {
  const result = await pool.query(`
    SELECT
      a.id, a.agent_id, a.public_key, a.scope_action, a.scope_limit,
      a.expiry, a.parent_attestation_id, a.created_at,
      EXISTS(SELECT 1 FROM revocations r WHERE r.attestation_id = a.id) AS is_revoked
    FROM attestations a
    ORDER BY a.created_at ASC
  `);

  res.status(200).json({
    attestations: result.rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      publicKey: row.public_key,
      scope: { action: row.scope_action, limit: row.scope_limit === null ? undefined : Number(row.scope_limit) },
      expiry: row.expiry,
      parentAttestationId: row.parent_attestation_id,
      createdAt: row.created_at,
      isRevoked: row.is_revoked,
      isExpired: new Date(row.expiry).getTime() < Date.now(),
    })),
  });
});

app.get("/audit-log", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const before = req.query.before as string | undefined;

  const result = before
    ? await pool.query(
        `SELECT id, agent_id, scope_action, tool_name, proof1_hash, proof2_hash, pass, reason, policy_commitment, created_at
         FROM audit_log WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2`,
        [before, limit]
      )
    : await pool.query(
        `SELECT id, agent_id, scope_action, tool_name, proof1_hash, proof2_hash, pass, reason, policy_commitment, created_at
         FROM audit_log ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );

  res.status(200).json({
    entries: result.rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      scopeAction: row.scope_action,
      toolName: row.tool_name,
      proof1Hash: row.proof1_hash,
      proof2Hash: row.proof2_hash,
      pass: row.pass,
      reason: row.reason,
      policyCommitment: row.policy_commitment,
      createdAt: row.created_at,
    })),
  });

});

// ---------------------------------------------------------------------------
// GET /audit-log/funnel — real aggregate counts for the Auditor Dashboard's
// "Verification Funnel" widget. Derived entirely from real audit_log rows
// written by gate.ts on every actual finance/admin gate invocation — no
// synthetic/hardcoded numbers. Each stage's count is "how many requests got
// at least this far", inferred from which failure reason (if any) was
// logged, since audit_log doesn't store a separate pass/fail flag per stage.
//
// Caveat, stated plainly rather than hidden: attacks 1-4 and 6 are pure
// protocol-layer demonstrations that never call the real gate (they fail at
// the sigma-proof algebra itself, client-side in attack-scripts), so this
// funnel only reflects traffic that actually reached finance-mcp-server or
// admin-mcp-server — real Task Interface usage plus exhibits 5, 7, 8, 9.
// ---------------------------------------------------------------------------
app.get("/audit-log/funnel", async (_req: Request, res: Response) => {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS traffic_received,
      COUNT(*) FILTER (
        WHERE reason IS NULL OR reason NOT LIKE 'Proof 1 (authorization) failed%'
      ) AS proof1_passed,
      COUNT(*) FILTER (
        WHERE (reason IS NULL OR reason NOT LIKE 'Proof 1 (authorization) failed%')
          AND (reason IS NULL OR reason NOT LIKE 'INTENT_BINDING_FAIL%')
      ) AS intent_binding_passed,
      COUNT(*) FILTER (
        WHERE proof2_hash IS NOT NULL
          AND (reason IS NULL OR reason NOT LIKE 'Proof 2 (compliance) failed%')
          AND (reason IS NULL OR reason NOT LIKE '%commitment%mismatch%')
          AND (reason IS NULL OR reason NOT LIKE '%not approved%')
      ) AS proof2_passed,
      COUNT(*) FILTER (WHERE pass = true) AS executed
    FROM audit_log
  `);
  const row = result.rows[0];
  res.status(200).json({
    stages: [
      { name: "Traffic Received", count: Number(row.traffic_received) },
      { name: "Proof 1 (Sigma)", count: Number(row.proof1_passed) },
      { name: "Intent Binding", count: Number(row.intent_binding_passed) },
      { name: "Proof 2 (Groth16)", count: Number(row.proof2_passed) },
      { name: "Executed", count: Number(row.executed) },
    ],
  });
});
//
// POST /intent-commitment
//   Called at ticket ingestion, BEFORE any LLM call. Accepts the structured
//   fields that only the authenticated customer can supply (orderRefs chosen
//   from their own order history, never parsed from free text). Validates
//   every orderRef belongs to the given customerId in the real DB. Stores
//   the commitment hash and initialises the session action counter.
//   The commitmentHash is what gets bound into the Fiat-Shamir challenge for
//   Proof 1 — so a sigma proof for orderRef "9102" is algebraically
//   incapable of authorising "9101".
//
// GET /intent-commitment/:sessionId
//   Used by the gate (finance-mcp-server) to check the stored commitment and
//   current action count before running Proof 2.
//
// POST /intent-action-increment/:sessionId
//   Atomically bumps the action counter. Called by the gate after intent
//   binding passes, before Proof 2 runs. Prevents salami-slicing: one
//   authorised request cannot trigger multiple executed actions.
// ---------------------------------------------------------------------------

import { createHash } from "crypto";

const intentCommitmentSchema = z.object({
  sessionId: z.string().min(1),
  customerId: z.string().min(1),
  orderRefs: z.array(z.string().min(1)).min(1),
  nonce: z.string().min(1),
  expirySeconds: z.number().positive().default(600),
});

app.post("/intent-commitment", async (req: Request, res: Response) => {
  const parsed = intentCommitmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const { sessionId, customerId, orderRefs, nonce, expirySeconds } = parsed.data;

  // Ownership check: every orderRef must genuinely belong to this customer.
  // This is checked against the real DB — not the agent's assertion — so an
  // injected orderRef for a different customer's order is rejected here,
  // before the LLM ever sees the ticket.
  for (const ref of orderRefs) {
    const result = await pool.query(
      `SELECT 1 FROM orders WHERE order_ref = $1 AND customer_id = $2`,
      [ref, customerId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({
        error: "ownership_check_failed",
        reason: `orderRef ${ref} does not belong to customer ${customerId}`,
      });
    }
  }

  // Compute commitment hash: SHA-256(customerId || sorted(orderRefs) || nonce || timestamp)
  // Sorting orderRefs makes the hash deterministic regardless of array order.
  const timestamp = Date.now().toString();
  const preimage = [customerId, ...orderRefs.slice().sort(), nonce, timestamp].join("|");
  const commitmentHash = createHash("sha256").update(preimage).digest("hex");

  const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

  // Was there a still-valid (unexpired) commitment for this session already?
  // This is the fork: a resubmission INSIDE the previous commitment's window
  // is the salami-slicing case (must NOT reset the count). A request arriving
  // AFTER the previous commitment expired is a genuinely new authorised
  // request (must reset — otherwise stale counts from a past, unrelated
  // request would wrongly block a legitimate future one).
  const existing = await pool.query(
    `SELECT expires_at FROM intent_commitments WHERE session_id = $1`,
    [sessionId]
  );
  const hadUnexpiredCommitment =
    existing.rows.length > 0 && new Date(existing.rows[0].expires_at).getTime() > Date.now();

  await pool.query(
    `INSERT INTO intent_commitments
       (session_id, customer_id, order_refs, expected_action_count, commitment_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (session_id) DO UPDATE
       SET customer_id = EXCLUDED.customer_id,
           order_refs = EXCLUDED.order_refs,
           expected_action_count = EXCLUDED.expected_action_count,
           commitment_hash = EXCLUDED.commitment_hash,
           expires_at = EXCLUDED.expires_at`,
    [sessionId, customerId, orderRefs, orderRefs.length, commitmentHash, expiresAt]
  );

  if (hadUnexpiredCommitment) {
    await pool.query(
      `INSERT INTO session_action_counts (session_id, count)
       VALUES ($1, 0)
       ON CONFLICT (session_id) DO NOTHING`,
      [sessionId]
    );
  } else {
    await pool.query(
      `INSERT INTO session_action_counts (session_id, count)
       VALUES ($1, 0)
       ON CONFLICT (session_id) DO UPDATE SET count = 0`,
      [sessionId]
    );
  }

  return res.status(201).json({ commitmentHash, expiresAt });
});

app.get("/intent-commitment/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const result = await pool.query(
    `SELECT ic.session_id, ic.customer_id, ic.order_refs, ic.expected_action_count,
            ic.commitment_hash, ic.expires_at,
            COALESCE(sac.count, 0) AS action_count
     FROM intent_commitments ic
     LEFT JOIN session_action_counts sac ON sac.session_id = ic.session_id
     WHERE ic.session_id = $1`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "no intent commitment found for this session" });
  }

  const row = result.rows[0];
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: "intent commitment has expired" });
  }

  return res.status(200).json({
    sessionId: row.session_id,
    customerId: row.customer_id,
    orderRefs: row.order_refs,
    expectedActionCount: row.expected_action_count,
    commitmentHash: row.commitment_hash,
    actionCount: Number(row.action_count),
    expiresAt: row.expires_at,
  });
});

app.post("/intent-action-increment/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  // Atomic increment — returns the NEW count so the caller can verify it
  // didn't race past the cap.
  const result = await pool.query(
    `UPDATE session_action_counts SET count = count + 1
     WHERE session_id = $1
     RETURNING count`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "no action count record for this session" });
  }

  return res.status(200).json({ newCount: result.rows[0].count });
});