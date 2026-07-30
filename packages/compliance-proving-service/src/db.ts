import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp",
});

export interface AccountRow {
  id: string;
  accountRef: string;
  consentGiven: boolean;
  daysSinceLastTransaction: number;
  hasActiveDependency: boolean;
  deleted: boolean;
}

export async function getAccount(accountRef: string): Promise<AccountRow | null> {
  try {
    const res = await pool.query(
      `SELECT id, account_ref, consent_given, has_active_dependency, deleted,
              EXTRACT(DAY FROM now() - last_transaction_date)::int AS days_since_last_transaction
       FROM accounts WHERE account_ref = $1`,
      [accountRef]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      accountRef: row.account_ref,
      consentGiven: row.consent_given,
      daysSinceLastTransaction: row.days_since_last_transaction,
      hasActiveDependency: row.has_active_dependency,
      deleted: row.deleted,
    };
  } catch (err) {
    console.error("Database error fetching account:", err);
    throw err;
  }
}