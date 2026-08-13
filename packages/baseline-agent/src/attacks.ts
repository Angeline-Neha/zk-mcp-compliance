import { Router } from "express";
import { loadOrderContext, executeRefund } from "./db";
import { evaluatePolicy, POLICY } from "./policy";

export const attackRouter = Router();
const AGENT_ID = "traditional-api-attacker";
const activeSessions = new Map<string, { customerId: string; createdAt: number }>();

/* Free, ungated read — same convention as finance-mcp-server's lookup_order,
   so an LLM red-team agent can discover real orderRefs (and who owns them)
   before spending a turn on a stateful attack call. No auth, no ownership
   check by design: this is a read-only reconnaissance tool, not a target. */
attackRouter.get("/lookup-order/:orderRef", async (req, res) => {
  const order = await loadOrderContext(req.params.orderRef);
  if (!order) return res.status(404).json({ error: "order not found" });
  const policy = evaluatePolicy(order);
  return res.json({
    orderRef: order.orderRef,
    ownedBy: order.customerId,
    amount: order.amount,
    accountAgeDays: order.accountAgeDays,
    pastRefundCount: order.pastRefundCount,
    transactionAgeDays: order.transactionAgeDays,
    wouldPolicyApprove: policy.approved,
    policyReason: policy.reason ?? null,
  });
});

/* Attack 1 - Token Replay: no nonce, same payload works every time */
attackRouter.post("/replay", async (req, res) => {
  const { customerId, orderRef } = req.body as { customerId: string; orderRef: string };
  if (!customerId || !orderRef) return res.status(400).json({ error: "missing fields" });
  const order = await loadOrderContext(orderRef);
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.customerId !== customerId) return res.status(403).json({ error: "not your order" });
  const policy = evaluatePolicy(order);
  if (!policy.approved) return res.json({ allowed: false, reason: policy.reason });
  const { refundId } = await executeRefund(order.orderId, order.orderRef, order.amount, AGENT_ID, "replay attack - no nonce");
  return res.json({
    allowed: true, refundId, orderRef, amount: order.amount,
    vulnerability: "ATTACK 1 REPLAY: No nonce burned. This same request will succeed every time it is replayed.",
    zkDifference: "ZK gate burns the nonce on first proof use. Any replay returns nonce_already_used.",
  });
});

/* Attack 2 - Confused Deputy: caller picks action, no cryptographic scope binding */
attackRouter.post("/confused-deputy", async (req, res) => {
  const { customerId, orderRef, action } = req.body as { customerId: string; orderRef: string; action: string };
  if (!customerId || !orderRef || !action) return res.status(400).json({ error: "missing fields" });
  const order = await loadOrderContext(orderRef);
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.customerId !== customerId) return res.status(403).json({ error: "not your order" });
  if (action === "delete") {
    return res.json({
      allowed: true, action: "delete", customerId, orderId: order.orderId,
      vulnerability: "ATTACK 2 CONFUSED DEPUTY: Caller-supplied action executed with refund-scoped credential. No cryptographic scope binding.",
      zkDifference: "ZK proof scope field is cryptographically bound. A refund proof cannot call delete_account.",
    });
  }
  const policy = evaluatePolicy(order);
  if (!policy.approved) return res.json({ allowed: false, reason: policy.reason });
  const { refundId } = await executeRefund(order.orderId, order.orderRef, order.amount, AGENT_ID, "confused deputy");
  return res.json({
    allowed: true, refundId, action,
    vulnerability: "ATTACK 2: Try action=delete to see scope abuse.",
    zkDifference: "ZK proof scope is cryptographically bound per tool.",
  });
});

/* Attack 3 - Privilege Escalation: caller supplies their own policy limit */
attackRouter.post("/privilege-escalation", async (req, res) => {
  const { customerId, orderRef, claimedLimit } = req.body as { customerId: string; orderRef: string; claimedLimit?: number };
  if (!customerId || !orderRef) return res.status(400).json({ error: "missing fields" });
  const order = await loadOrderContext(orderRef);
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.customerId !== customerId) return res.status(403).json({ error: "not your order" });
  const realPolicy = evaluatePolicy(order);
  const effectiveLimit = typeof claimedLimit === "number" ? claimedLimit : POLICY.policyLimit;
  const escalatedApproved =
    order.amount <= effectiveLimit &&
    order.accountAgeDays >= POLICY.minAccountAgeDays &&
    order.pastRefundCount < POLICY.maxPastRefundCount &&
    order.transactionAgeDays <= POLICY.maxTransactionAgeDays;
  if (!escalatedApproved) {
    return res.json({ allowed: false, reason: "still fails even with claimed limit", realLimit: POLICY.policyLimit, claimedLimit: effectiveLimit });
  }
  const { refundId } = await executeRefund(order.orderId, order.orderRef, order.amount, AGENT_ID, "privilege escalation");
  return res.json({
    allowed: true, refundId, realLimit: POLICY.policyLimit, effectiveLimitUsed: effectiveLimit,
    realPolicyWouldApprove: realPolicy.approved,
    escalated: !realPolicy.approved && escalatedApproved,
    vulnerability: "ATTACK 3 PRIVILEGE ESCALATION: Policy limit trusted from request body, not a cryptographic commitment.",
    zkDifference: "ZK Groth16 circuit commits the limit at registration. Forged values fail the circuit.",
  });
});

/* Attack 4 - IDOR: no ownership binding, any orderRef accepted */
attackRouter.post("/idor", async (req, res) => {
  const { orderRef } = req.body as { orderRef: string };
  if (!orderRef) return res.status(400).json({ error: "missing orderRef" });
  const order = await loadOrderContext(orderRef);
  if (!order) return res.status(404).json({ error: "order not found" });
  const policy = evaluatePolicy(order);
  if (!policy.approved) return res.json({ allowed: false, reason: policy.reason, ownedBy: order.customerId });
  const { refundId } = await executeRefund(order.orderId, order.orderRef, order.amount, AGENT_ID, "IDOR no ownership check");
  return res.json({
    allowed: true, refundId, orderRef, ownedBy: order.customerId,
    note: "Refund issued without verifying caller owns this order",
    vulnerability: "ATTACK 4 IDOR: orderRef accepted from request body with no ownership binding.",
    zkDifference: "ZK intent hash commits the orderRef before LLM runs. Tampered ref fails intent check.",
  });
});

/* Attack 5 - Cross-Service: any service header accepted, no audience check */
attackRouter.post("/cross-service", async (req, res) => {
  const { customerId, orderRef, serviceHeader } = req.body as { customerId: string; orderRef: string; serviceHeader?: string };
  if (!customerId || !orderRef) return res.status(400).json({ error: "missing fields" });
  const claimedService = serviceHeader ?? "unknown-service";
  const order = await loadOrderContext(orderRef);
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.customerId !== customerId) return res.status(403).json({ error: "not your order" });
  const policy = evaluatePolicy(order);
  if (!policy.approved) return res.json({ allowed: false, reason: policy.reason });
  const { refundId } = await executeRefund(order.orderId, order.orderRef, order.amount, AGENT_ID, `cross-service from ${claimedService}`);
  return res.json({
    allowed: true, refundId, claimedService,
    vulnerability: "ATTACK 5 CROSS-SERVICE: Any service claim accepted. No audience binding on the credential.",
    zkDifference: "ZK proof contains serverId. Presenting a finance proof to admin gate fails because serverId mismatches.",
  });
});

/* Attack 6 - TOCTOU: create session, revoke it, use it anyway */
attackRouter.post("/session/create", (req, res) => {
  const { customerId } = req.body as { customerId: string };
  if (!customerId) return res.status(400).json({ error: "missing customerId" });
  const sessionId = "sess_" + Math.random().toString(36).slice(2, 10);
  activeSessions.set(sessionId, { customerId, createdAt: Date.now() });
  return res.json({ sessionId, customerId, note: "Session created. Next: POST /attack/session/revoke with sessionId, then POST /attack/toctou-refund." });
});

attackRouter.post("/session/revoke", (req, res) => {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) return res.status(400).json({ error: "missing sessionId" });
  const existed = activeSessions.has(sessionId);
  activeSessions.delete(sessionId);
  return res.json({ revoked: existed, sessionId, note: "Session revoked. Now try /attack/toctou-refund to see it still works." });
});

attackRouter.post("/toctou-refund", async (req, res) => {
  const { customerId, orderRef, sessionId } = req.body as { customerId: string; orderRef: string; sessionId?: string };
  if (!customerId || !orderRef) return res.status(400).json({ error: "missing fields" });
  const sessionExists = sessionId ? activeSessions.has(sessionId) : false;
  const order = await loadOrderContext(orderRef);
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.customerId !== customerId) return res.status(403).json({ error: "not your order" });
  const policy = evaluatePolicy(order);
  if (!policy.approved) return res.json({ allowed: false, reason: policy.reason });
  const { refundId } = await executeRefund(order.orderId, order.orderRef, order.amount, AGENT_ID, "TOCTOU - revoked session used");
  return res.json({
    allowed: true, refundId, sessionId: sessionId ?? null, sessionStillActive: sessionExists,
    vulnerability: sessionId && !sessionExists
      ? "ATTACK 6 TOCTOU: Refund processed even though session was revoked. No revocation check."
      : "Refund processed (session still active).",
    zkDifference: "ZK gate checks attestation revocation on every proof. Revoked agents cannot generate valid proofs.",
  });
});

/* Attack 7 - Fake Compliance: caller supplies their own policy field values */
attackRouter.post("/fake-compliance", async (req, res) => {
  const { customerId, orderRef, fakeFields } = req.body as {
    customerId: string;
    orderRef: string;
    fakeFields?: { amount?: number; accountAgeDays?: number; pastRefundCount?: number; transactionAgeDays?: number };
  };
  if (!customerId || !orderRef) return res.status(400).json({ error: "missing fields" });
  const order = await loadOrderContext(orderRef);
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.customerId !== customerId) return res.status(403).json({ error: "not your order" });
  const realPolicy = evaluatePolicy(order);
  const evaluatedOrder = {
    amount:             fakeFields?.amount             ?? order.amount,
    accountAgeDays:     fakeFields?.accountAgeDays     ?? order.accountAgeDays,
    pastRefundCount:    fakeFields?.pastRefundCount     ?? order.pastRefundCount,
    transactionAgeDays: fakeFields?.transactionAgeDays ?? order.transactionAgeDays,
  };
  const fakePolicy = evaluatePolicy(evaluatedOrder);
  if (!fakePolicy.approved) {
    return res.json({
      allowed: false, reason: fakePolicy.reason,
      realValues: { amount: order.amount, accountAgeDays: order.accountAgeDays, pastRefundCount: order.pastRefundCount, transactionAgeDays: order.transactionAgeDays },
    });
  }
  const { refundId } = await executeRefund(order.orderId, order.orderRef, order.amount, AGENT_ID, "fake compliance");
  return res.json({
    allowed: true, refundId,
    realValues: { amount: order.amount, accountAgeDays: order.accountAgeDays, pastRefundCount: order.pastRefundCount, transactionAgeDays: order.transactionAgeDays },
    callerSuppliedFakeValues: fakeFields ?? {},
    realPolicyWouldApprove: realPolicy.approved,
    exploited: !realPolicy.approved,
    vulnerability: "ATTACK 7 FAKE COMPLIANCE: Policy evaluated against caller-supplied fields, not real DB values.",
    zkDifference: "ZK Groth16 circuit evaluates real DB values committed at proof time. Forged fields fail the circuit.",
  });
});
