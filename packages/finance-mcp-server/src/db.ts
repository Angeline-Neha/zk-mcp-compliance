import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp",
});

export interface RealOrderContext {
  orderId: string;
  customerId: string;
  amount: number;
  transactionAgeDays: number;
  accountAgeDays: number;
  pastRefundCount: number;
}

/**
 * Loads the REAL context needed to evaluate the compliance circuit against
 * an order — this is what a real compliance micro-service would hold
 * per Stage 5 of the spec ("Agent (or a compliance micro-service holding
 * the real transaction data)..."). Nothing here is agent-claimed; it's all
 * derived from the actual ledger.
 */
export async function loadOrderContext(orderRef: string): Promise<RealOrderContext | null> {
  const orderRes = await pool.query(
    `SELECT id, customer_id, amount,
            EXTRACT(DAY FROM now() - transaction_date)::int AS transaction_age_days
     FROM orders WHERE order_ref = $1`,
    [orderRef]
  );
  if (orderRes.rows.length === 0) return null;
  const order = orderRes.rows[0];

  const customerRes = await pool.query(
    `SELECT EXTRACT(DAY FROM now() - account_created_at)::int AS account_age_days
     FROM customers WHERE customer_id = $1`,
    [order.customer_id]
  );
  if (customerRes.rows.length === 0) return null;

  const refundCountRes = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM refunds r
     JOIN orders o ON r.order_id = o.id
     WHERE o.customer_id = $1 AND r.created_at > now() - interval '90 days'`,
    [order.customer_id]
  );

  return {
    orderId: order.id,
    customerId: order.customer_id,
    amount: Number(order.amount),
    transactionAgeDays: order.transaction_age_days,
    accountAgeDays: customerRes.rows[0].account_age_days,
    pastRefundCount: refundCountRes.rows[0].count,
  };
}

/**
 * Actually executes the refund against the real ledger. Only ever called
 * after the gate has returned allowed:true — this function itself performs
 * no policy checking, it trusts the gate completely (separation of
 * concerns: gate decides, this function just does).
 */
export async function executeRefund(
  orderId: string,
  amount: number,
  agentId: string
): Promise<{ refundId: string }> {
  const result = await pool.query(
    `INSERT INTO refunds (order_id, amount, agent_id, status)
     VALUES ($1, $2, $3, 'issued')
     RETURNING id`,
    [orderId, amount, agentId]
  );
  return { refundId: result.rows[0].id };
}
