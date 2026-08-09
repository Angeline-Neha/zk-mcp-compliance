import { Router } from "express";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp",
});

export const dbSnapshotRouter = Router();

/**
 * Tables shown in the auditor's live DB panel, grouped by which service
 * owns them. `latestCols` picks a few readable columns for the preview
 * rows — full rows would be too wide for the panel.
 */
const TABLES: { key: string; label: string; latestCols: string[]; orderCol: string; limit: number }[] = [
  { key: "attestations", label: "Attestations (Issuer)", latestCols: ["agent_id", "scope_action", "scope_limit", "expiry"], orderCol: "created_at", limit: 5 },
  { key: "revocations", label: "Revocations (Issuer)", latestCols: ["attestation_id", "reason", "revoked_at"], orderCol: "revoked_at", limit: 5 },
  { key: "audit_log", label: "Audit Log (Issuer)", latestCols: ["agent_id", "scope_action", "pass", "reason"], orderCol: "created_at", limit: 5 },
  { key: "intent_commitments", label: "Intent Commitments (Issuer)", latestCols: ["session_id", "customer_id", "order_refs", "expected_action_count"], orderCol: "created_at", limit: 5 },
  { key: "customers", label: "Customers", latestCols: ["customer_id", "account_created_at"], orderCol: "account_created_at", limit: 100 },
  { key: "orders", label: "Orders (Finance)", latestCols: ["order_ref", "customer_id", "amount"], orderCol: "created_at", limit: 100 },
  { key: "refunds", label: "Refunds (Finance, ZK-MCP)", latestCols: ["order_id", "amount", "agent_id", "status"], orderCol: "created_at", limit: 5 },
  { key: "baseline_refunds", label: "Refunds (Baseline)", latestCols: ["order_ref", "amount", "agent_id", "status"], orderCol: "created_at", limit: 5 },
  { key: "accounts", label: "Accounts (Admin)", latestCols: ["account_ref", "customer_id", "deleted"], orderCol: "created_at", limit: 5 },
];

/**
 * GET /auditor/db-snapshot
 * Live read-only view into every table across all services' Postgres
 * schemas — row counts + 5 most recent rows per table, ordered by
 * created_at/revoked_at descending. Polled every ~2s from the frontend
 * so the auditor dashboard shows DB state changing in real time as
 * attacks/tasks run.
 */
dbSnapshotRouter.get("/db-snapshot", async (_req, res) => {
  try {
    const results = await Promise.all(
      TABLES.map(async (t) => {
        try {
          const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM ${t.key}`);
          const colsSql = t.latestCols.join(", ");
          const rowsRes = await pool.query(
            `SELECT ${colsSql}, ${t.orderCol} FROM ${t.key} ORDER BY ${t.orderCol} DESC LIMIT ${t.limit}`
          );
          return {
            key: t.key,
            label: t.label,
            count: countRes.rows[0].count,
            latest: rowsRes.rows,
            ok: true,
          };
        } catch (err: any) {
          // Table may not exist yet if that service hasn't run its migration
          // in this environment — report it instead of failing the whole snapshot.
          return { key: t.key, label: t.label, count: 0, latest: [], ok: false, error: err.message };
        }
      })
    );
    res.json({ tables: results, fetchedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});