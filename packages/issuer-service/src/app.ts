import express, { Request, Response } from "express";
import { Express } from "express";
import { z } from "zod";
import { verifyProof } from "@zk-mcp/sigma-core";
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
import { issueNonce, checkAndBurnNonce } from "./nonceStore";
import { pool } from "./db";

export const app: Express = express();
app.use(express.json());

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
});

app.post("/verify", async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const { attestationId, proof, nonce, serverId, requestedScope } = parsed.data;

  const attestation = await getAttestation(attestationId);
  if (!attestation) {
    return res.status(200).json({ valid: false, reason: "attestation does not exist" });
  }

  // scope check (confused-deputy / lateral-movement protection, Attacks #2 and #4)
  if (
    attestation.scope.action !== requestedScope.action ||
    (attestation.scope.limit !== undefined &&
      requestedScope.limit !== undefined &&
      requestedScope.limit > attestation.scope.limit)
  ) {
    return res.status(200).json({ valid: false, reason: "scope mismatch" });
  }

  if (await isExpired(attestation)) {
    return res.status(200).json({ valid: false, reason: "attestation expired" });
  }

  // revocation re-checked HERE, at verify-time — not cached from
  // registration/proof-generation time. This is what stops the
  // TOCTOU / revocation-race attack (#6).
  if (await isRevoked(attestation.id)) {
    return res.status(200).json({ valid: false, reason: "attestation revoked" });
  }

  if (!(await verifyChainNarrows(attestation.id))) {
    return res.status(200).json({ valid: false, reason: "delegation chain does not narrow" });
  }

  // nonce check + burn — atomic, must happen before we accept the algebra
  // as meaningful, since an already-burned nonce means this exact proof
  // context was already consumed (Attack #1: replay).
  const nonceOk = await checkAndBurnNonce(requestedScope.action, serverId, nonce);
  if (!nonceOk) {
    return res.status(200).json({ valid: false, reason: "nonce already burned or expired" });
  }

  // finally, the actual algebraic check — sigma-core, zero dependencies,
  // trusted blindly per Phase 1.
  const sigmaValid = verifyProof(proof, attestation.publicKey, {
    scope: requestedScope.action,
    nonce,
    serverId,
  });

  if (!sigmaValid) {
    return res.status(200).json({ valid: false, reason: "sigma proof algebra failed (s·G != R + c·P)" });
  }

  // Note: audit logging is intentionally NOT done here. /verify only checks
  // Proof 1 in isolation (it has no visibility into Proof 2 or the overall
  // tool-call outcome). The gate (finance-mcp-server) is responsible for
  // writing the single, unified audit entry via POST /audit once BOTH
  // proofs have been checked — see Stage 7 of the spec.

  res.status(200).json({ valid: true });
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