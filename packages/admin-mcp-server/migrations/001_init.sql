-- admin-mcp-server — Phase 6 minimal stand-up
-- Only enough real state for delete_account to genuinely mutate
-- something. Full deletionPolicy.circom + compliance proof comes in
-- Phase 7 — this minimal version exists specifically to make Attack #5
-- (cross-server credential reuse) testable against a REAL second server,
-- not a second string constant.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_ref         TEXT NOT NULL UNIQUE,
  customer_id         TEXT NOT NULL,
  deleted             BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);