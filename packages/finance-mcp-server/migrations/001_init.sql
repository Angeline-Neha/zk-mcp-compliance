-- finance-mcp-server — Phase 4
-- A minimal, real orders/refunds ledger. issue_refund mutates this table
-- for real — it is not a stub that just returns {success: true}.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS customers (
  customer_id         TEXT PRIMARY KEY,
  account_created_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref           TEXT NOT NULL UNIQUE, -- human-facing order number, e.g. "4521"
  customer_id         TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  transaction_date    TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refunds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  amount              NUMERIC NOT NULL,
  agent_id            TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'issued', -- 'issued' | 'escalated'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
