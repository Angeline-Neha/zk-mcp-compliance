-- admin-mcp-server — Phase 7 upgrade from minimal (Proof 1 only) to full
-- two-proof gate. Adds the real fields deletionPolicy.circom needs.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_transaction_date TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS has_active_dependency BOOLEAN NOT NULL DEFAULT false;