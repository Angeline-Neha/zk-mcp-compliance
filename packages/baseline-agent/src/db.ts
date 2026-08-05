import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp",
});

export interface OrderContext {
  orderId: string;
  orderRef: string;
  customerId: string;
  amount: number;
  transactionAgeDays: number;
  accountAgeDays: number;
  pastRefundCount: number;
}

/**
 * Loads real order/customer context — same underlying tables as the secure
 * system (finance-mcp-server), so both agents see identical data. The only
 * difference is pastRefundCount, which is counted against THIS system's own
 * baseline_refunds ledger so the two demos don't contaminate each other.
 */
export async function loadOrderContext(orderRef: string): Promise<OrderContext | null> {
  const orderRes = await pool.query(
    `SELECT id, order_ref, customer_id, amount,
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
     FROM baseline_refunds br
     JOIN orders o ON br.order_id = o.id
     WHERE o.customer_id = $1 AND br.created_at > now() - interval '90 days'`,
    [order.customer_id]
  );

  return {
    orderId: order.id,
    orderRef: order.order_ref,
    customerId: order.customer_id,
    amount: Number(order.amount),
    transactionAgeDays: order.transaction_age_days,
    accountAgeDays: customerRes.rows[0].account_age_days,
    pastRefundCount: refundCountRes.rows[0].count,
  };
}

/**
 * Actually issues the refund. Called only after ownership + policy checks
 * pass in agent.ts — this function itself performs no checking, same
 * separation-of-concerns convention as the secure system's executeRefund.
 */
export async function executeRefund(
  orderId: string,
  orderRef: string,
  amount: number,
  agentId: string,
  justification: string
): Promise<{ refundId: string }> {
  const result = await pool.query(
    `INSERT INTO baseline_refunds (order_id, order_ref, amount, agent_id, justification, status)
     VALUES ($1, $2, $3, $4, $5, 'issued')
     RETURNING id`,
    [orderId, orderRef, amount, agentId, justification]
  );
  return { refundId: result.rows[0].id };
}
