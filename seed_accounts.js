import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp"
});

async function main() {
  console.log("Connecting to database...");
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log("Seeding accounts table for admin-mcp-server exhibits...");
    // acct-001: used by attack-scripts' standalone CLI version of exhibit V
    // acct-002: used by demo-gateway's crossServerReuse.ts, which is what
    //           the actual frontend exhibit V panel calls — this is the
    //           one the UI needs to exist for the lookup to succeed.
    const accounts = [
      ['acct-001', 'cust-pass-1', true, false],
      ['acct-002', 'cust-pass-2', true, false],
    ];
    for (const [accountRef, customerId, consentGiven, hasActiveDependency] of accounts) {
      await client.query(
        `INSERT INTO accounts (account_ref, customer_id, consent_given, has_active_dependency, last_transaction_date)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '10 days')
         ON CONFLICT (account_ref) DO NOTHING`,
        [accountRef, customerId, consentGiven, hasActiveDependency]
      );
    }

    await client.query('COMMIT');
    console.log("Accounts seeded successfully (acct-001, acct-002).");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error seeding accounts:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();