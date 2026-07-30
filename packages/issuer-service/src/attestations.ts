import { pool } from "./db";

export interface Scope {
  action: string;
  limit?: number;
}

export interface Attestation {
  id: string;
  agentId: string;
  publicKey: string;
  scope: Scope;
  expiry: string;
  parentAttestationId: string | null;
  createdAt: string;
}

export class DelegationRejectedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "DelegationRejectedError";
  }
}

function rowToAttestation(row: any): Attestation {
  return {
    id: row.id,
    agentId: row.agent_id,
    publicKey: row.public_key,
    scope: {
      action: row.scope_action,
      limit: row.scope_limit === null ? undefined : Number(row.scope_limit),
    },
    expiry: row.expiry,
    parentAttestationId: row.parent_attestation_id,
    createdAt: row.created_at,
  };
}

/**
 * childScope ⊆ parentScope, strict subset check on every constrained field.
 * - action must match exactly (you cannot delegate into a different action)
 * - if the parent scope carries a numeric limit, the child's limit must be
 *   present and <= the parent's limit (a child with NO limit when the
 *   parent HAS one would be a widening, and is rejected)
 *
 * This is deliberately exported and unit-testable on its own — it is the
 * exact function that stops Attack #3 (privilege escalation via delegation).
 */
export function isSubsetScope(child: Scope, parent: Scope): boolean {
  if (child.action !== parent.action) return false;
  if (parent.limit !== undefined) {
    if (child.limit === undefined) return false;
    if (child.limit > parent.limit) return false;
  }
  return true;
}

export async function registerAttestation(params: {
  agentId: string;
  publicKey: string;
  scope: Scope;
  expirySeconds: number;
}): Promise<Attestation> {
  const { agentId, publicKey, scope, expirySeconds } = params;
  const result = await pool.query(
    `INSERT INTO attestations (agent_id, public_key, scope_action, scope_limit, expiry)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval)
     RETURNING *`,
    [agentId, publicKey, scope.action, scope.limit ?? null, expirySeconds]
  );
  return rowToAttestation(result.rows[0]);
}

export async function getAttestation(id: string): Promise<Attestation | null> {
  const result = await pool.query(`SELECT * FROM attestations WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return rowToAttestation(result.rows[0]);
}

export async function isExpired(attestation: Attestation): Promise<boolean> {
  return new Date(attestation.expiry).getTime() < Date.now();
}

export async function isRevoked(attestationId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM revocations WHERE attestation_id = $1 LIMIT 1`,
    [attestationId]
  );
  return result.rows.length > 0;
}

export async function revokeAttestation(
  attestationId: string,
  reason: string
): Promise<void> {
  const existing = await getAttestation(attestationId);
  if (!existing) {
    throw new Error(`Cannot revoke: attestation ${attestationId} does not exist`);
  }
  await pool.query(
    `INSERT INTO revocations (attestation_id, reason) VALUES ($1, $2)`,
    [attestationId, reason]
  );
}

/**
 * Mint a child attestation delegated from a parent. This is the ONLY path
 * by which a child attestation can be created — the requested scope is
 * ALWAYS checked server-side against the parent's actual held scope.
 * Never trust a delegation request's claimed scope on its own.
 */
export async function delegateAttestation(params: {
  parentAttestationId: string;
  childAgentId: string;
  childPublicKey: string;
  requestedScope: Scope;
  expirySeconds: number;
}): Promise<Attestation> {
  const { parentAttestationId, childAgentId, childPublicKey, requestedScope, expirySeconds } =
    params;

  const parent = await getAttestation(parentAttestationId);
  if (!parent) {
    throw new DelegationRejectedError("parent attestation does not exist");
  }
  if (await isExpired(parent)) {
    throw new DelegationRejectedError("parent attestation is expired");
  }
  if (await isRevoked(parent.id)) {
    throw new DelegationRejectedError("parent attestation is revoked");
  }
  if (!isSubsetScope(requestedScope, parent.scope)) {
    throw new DelegationRejectedError(
      `requested scope {action: ${requestedScope.action}, limit: ${requestedScope.limit}} ` +
        `is not a subset of parent scope {action: ${parent.scope.action}, limit: ${parent.scope.limit}}`
    );
  }

  const result = await pool.query(
    `INSERT INTO attestations (agent_id, public_key, scope_action, scope_limit, expiry, parent_attestation_id)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval, $6)
     RETURNING *`,
    [
      childAgentId,
      childPublicKey,
      requestedScope.action,
      requestedScope.limit ?? null,
      expirySeconds,
      parent.id,
    ]
  );
  return rowToAttestation(result.rows[0]);
}

/**
 * Walk the full delegation chain from this attestation up to its root and
 * confirm every step narrows (never widens). This is a defense-in-depth
 * re-check at verify-time — delegateAttestation() already enforces this at
 * mint-time, but the spec calls for the chain to be "verified transitively"
 * at the point of use too, in case of any future path that could otherwise
 * mint a bad row directly.
 */
export async function verifyChainNarrows(attestationId: string): Promise<boolean> {
  let current = await getAttestation(attestationId);
  if (!current) return false;

  while (current.parentAttestationId) {
    const parent = await getAttestation(current.parentAttestationId);
    if (!parent) return false;
    if (!isSubsetScope(current.scope, parent.scope)) return false;
    current = parent;
  }
  return true;
}
