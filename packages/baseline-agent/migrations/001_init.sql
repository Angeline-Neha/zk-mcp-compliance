-- baseline-agent — traditional (non-ZK) comparison agent
--
-- Reads the SAME orders/customers tables the secure system uses (seeded by
-- the shared seed.js), so both systems are evaluated against identical data.
-- Writes to its OWN refunds ledger (baseline_refunds), kept separate from
-- finance-mcp-server's `refunds` table so firing attacks against one system
-- never mutates the other system's pastRefundCount / demo state.

CREATE TABLE IF NOT EXISTS baseline_refunds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  order_ref           TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  agent_id            TEXT NOT NULL,
  justification       TEXT,
  status              TEXT NOT NULL DEFAULT 'issued', -- 'issued' | 'escalated'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_baseline_refunds_order ON baseline_refunds(order_id);
