const FINANCE_URL = process.env.FINANCE_URL ?? "http://localhost:4003";

export interface RealOrderProfile {
  orderRef: string;
  amount: number;
  accountAgeDays: number;
  pastRefundCount: number;
  transactionAgeDays: number;
}

/**
 * Looks up an order's REAL profile (amount, account age, past refund count,
 * transaction age) via finance-mcp-server's read-only lookup_order tool —
 * the same data the compliance circuit would be evaluated against. Used by
 * the exhibit scripts so a user-chosen orderRef always drives every value
 * downstream (circuit input, claimedAmount, etc.) instead of a hardcoded
 * number that may not match what's actually in the DB.
 */
export async function lookupRealOrder(orderRef: string): Promise<RealOrderProfile> {
  const res = await fetch(`${FINANCE_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "lookup_order", arguments: { orderRef } },
    }),
  });
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  const parsed = dataLine ? JSON.parse(dataLine.slice("data:".length).trim()) : null;
  const content = parsed?.result?.content?.[0]?.text;
  if (parsed?.result?.isError || !content) {
    throw new Error(`Order "${orderRef}" not found — pick a real seeded order from the dropdown.`);
  }
  return JSON.parse(content) as RealOrderProfile;
}
