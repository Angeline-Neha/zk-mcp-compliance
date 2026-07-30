-- Migration 002: Intent commitment store for Attack 8 (intent-binding extension)
--
-- intent_commitments: one row per support ticket session, written at
-- ingestion time BEFORE the LLM sees the ticket. Stores the
-- authenticated set of orderRefs the customer explicitly chose (never
-- parsed from free text) and the commitment hash that gets bound into
-- the Fiat-Shamir challenge for Proof 1.
--
-- session_action_counts: atomic counter so the gate can enforce
-- expectedActionCount (blocks salami-slicing: one authorized request
-- triggering multiple executed actions).

CREATE TABLE IF NOT EXISTS intent_commitments (
  session_id            TEXT PRIMARY KEY,
  customer_id           TEXT NOT NULL,
  order_refs            TEXT[] NOT NULL,
  expected_action_count INT NOT NULL DEFAULT 1,
  commitment_hash       TEXT NOT NULL,   -- SHA-256 hex, bound into sigma challenge
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS session_action_counts (
  session_id  TEXT PRIMARY KEY REFERENCES intent_commitments(session_id) ON DELETE CASCADE,
  count       INT NOT NULL DEFAULT 0
);

-- Index for expiry cleanup (optional cron)
CREATE INDEX IF NOT EXISTS idx_intent_commitments_expires_at
  ON intent_commitments (expires_at);
