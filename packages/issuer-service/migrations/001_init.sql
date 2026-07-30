-- issuer-service — Phase 2
-- Tables: attestations, revocations, policy_commitments
-- pgcrypto is required for gen_random_uuid() used as the default for every
-- primary key below. Enabling it here keeps this migration self-contained
-- instead of relying on a separate manual step.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Note: revocation is modeled as an append-only log (revocations table),
-- NOT a boolean flag on attestations — this keeps the revocation check
-- honest (a real re-check against a real table at verify-time) rather
-- than a mutable flag that could be stale or cached.

CREATE TABLE IF NOT EXISTS attestations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            TEXT NOT NULL,
  public_key          TEXT NOT NULL,       -- hex-encoded compressed secp256k1 point
  scope_action        TEXT NOT NULL,       -- e.g. 'issue_refund'
  scope_limit         NUMERIC,             -- nullable: not every scope has a numeric limit
  expiry              TIMESTAMPTZ NOT NULL,
  parent_attestation_id UUID REFERENCES attestations(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attestations_agent ON attestations(agent_id);
CREATE INDEX IF NOT EXISTS idx_attestations_parent ON attestations(parent_attestation_id);

CREATE TABLE IF NOT EXISTS revocations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attestation_id      UUID NOT NULL REFERENCES attestations(id),
  reason              TEXT NOT NULL,
  revoked_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revocations_attestation ON revocations(attestation_id);

CREATE TABLE IF NOT EXISTS policy_commitments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_scope          TEXT NOT NULL UNIQUE, -- e.g. 'issue_refund'
  commitment_hex      TEXT NOT NULL,        -- Poseidon(policyLimit, salt) — Phase 3 will populate this
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log — Stage 7 of the spec. Append-only by convention (no UPDATE/DELETE
-- granted to the service role in production; enforced here at minimum by
-- never issuing an UPDATE/DELETE statement against this table anywhere in code).
CREATE TABLE IF NOT EXISTS audit_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            TEXT NOT NULL,
  scope_action        TEXT NOT NULL,
  proof1_hash         TEXT,                 -- sigma proof hash, never the raw proof/private data
  pass                BOOLEAN NOT NULL,
  reason              TEXT,                 -- rejection reason if pass = false
  policy_commitment   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
