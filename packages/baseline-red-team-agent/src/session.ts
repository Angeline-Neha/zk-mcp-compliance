const BASELINE_URL = process.env.BASELINE_AGENT_URL ?? "http://localhost:4008";

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASELINE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { httpStatus: res.status, ...json };
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASELINE_URL}${path}`);
  const json = await res.json().catch(() => ({}));
  return { httpStatus: res.status, ...json };
}

/**
 * Live state for a single baseline red-team run. Every method here makes a
 * real HTTP call against the actually-running baseline-agent (/attack/*) —
 * nothing is canned. The LLM decides which of these to call, in what order,
 * and with what arguments, exactly like RedTeamSession does for the ZK side.
 */
export class BaselineRedTeamSession {
  async lookup_order(input: { orderRef: string }) {
    return get(`/attack/lookup-order/${encodeURIComponent(input.orderRef)}`);
  }
  async submit_refund(input: { customerId: string; orderRef: string }) {
    return post("/attack/replay", input);
  }
  async submit_confused_deputy(input: { customerId: string; orderRef: string; action: string }) {
    return post("/attack/confused-deputy", input);
  }
  async submit_privilege_escalation(input: { customerId: string; orderRef: string; claimedLimit?: number }) {
    return post("/attack/privilege-escalation", input);
  }
  async submit_idor(input: { orderRef: string }) {
    return post("/attack/idor", input);
  }
  async submit_cross_service(input: { customerId: string; orderRef: string; serviceHeader?: string }) {
    return post("/attack/cross-service", input);
  }
  async create_session(input: { customerId: string }) {
    return post("/attack/session/create", input);
  }
  async revoke_session(input: { sessionId: string }) {
    return post("/attack/session/revoke", input);
  }
  async submit_toctou_refund(input: { customerId: string; orderRef: string; sessionId?: string }) {
    return post("/attack/toctou-refund", input);
  }
  async submit_fake_compliance(input: {
    customerId: string;
    orderRef: string;
    fakeFields?: { amount?: number; accountAgeDays?: number; pastRefundCount?: number; transactionAgeDays?: number };
  }) {
    return post("/attack/fake-compliance", input);
  }
}
