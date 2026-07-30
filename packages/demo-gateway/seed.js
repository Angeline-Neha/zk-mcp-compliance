import { Pool } from 'pg';
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp"
});

async function main() {
  console.log("Connecting to database...");
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log("Removing all existing data...");
    await client.query('TRUNCATE TABLE refunds, orders, customers CASCADE');
    
    // Also truncate accounts for admin-mcp-server if they exist
    try {
      await client.query('TRUNCATE TABLE accounts CASCADE');
    } catch (e) {
      console.log("No accounts table found, skipping.");
    }

    console.log("Inserting 20 compliant customers...");
    for (let i = 1; i <= 20; i++) {
      const custId = `cust-pass-${i}`;
      const orderRef = `100${i}`;
      
      // Account created 60 days ago
      await client.query(
        'INSERT INTO customers (customer_id, account_created_at) VALUES ($1, NOW() - INTERVAL \'60 days\')',
        [custId]
      );
      
      // Order amount 50, transaction 10 days ago
      await client.query(
        'INSERT INTO orders (order_ref, customer_id, amount, transaction_date) VALUES ($1, $2, $3, NOW() - INTERVAL \'10 days\')',
        [orderRef, custId, 50]
      );
    }

    console.log("Inserting 15 non-compliant customers...");
    for (let i = 1; i <= 15; i++) {
      const custId = `cust-fail-${i}`;
      const orderRef = `200${i}`;
      
      // Account created 5 days ago (FAILS: Account Age < 30)
      await client.query(
        'INSERT INTO customers (customer_id, account_created_at) VALUES ($1, NOW() - INTERVAL \'5 days\')',
        [custId]
      );
      
      // Order amount 500 (FAILS: Amount > 150), transaction 150 days ago (FAILS: Txn > 120 days)
      await client.query(
        'INSERT INTO orders (order_ref, customer_id, amount, transaction_date) VALUES ($1, $2, $3, NOW() - INTERVAL \'150 days\')',
        [orderRef, custId, 500]
      );
    }
    
    await client.query('COMMIT');
    console.log("Database seeded successfully with 20 compliant and 15 non-compliant customers.");
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error seeding database:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
