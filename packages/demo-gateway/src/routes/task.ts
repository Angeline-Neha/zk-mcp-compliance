import express, { Router } from "express";
import { z } from "zod";
import { handleIncomingTask, handleIncomingStructuredTask } from "@zk-mcp/orchestrator-agent";
import { handleTicket } from "@zk-mcp/admin-agent";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp",
});

const bodySchema = z.object({ ticketText: z.string().min(1) });

const structuredBodySchema = z.object({
  customerId: z.string().min(1),
  ticketText: z.string().min(1),
});

export const taskRouter: Router = express.Router();

taskRouter.get("/customers", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT customer_id as id, customer_id as name FROM customers ORDER BY customer_id"
    );
    res.status(200).json({ customers: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRouter.get("/customers/:id/orders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT order_ref as \"orderRef\" FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
      [req.params.id]
    );
    res.status(200).json({ orders: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRouter.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid request" });
  try {
    const result = await handleIncomingTask(parsed.data.ticketText);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Attack 8 — Structured intake route.
 *
 * The customerId comes from the authenticated session (simulated here by the
 * request body, but in production it would come from a JWT/cookie — never
 * from free text).
 *
 * The server:
 *   1. Extracts the FIRST order ref mentioned in the ticket text using a regex
 *   2. Validates it belongs to this customer in the real DB (ownership check)
 *   3. Commits the intent (POST /intent-commitment) BEFORE forwarding to LLM
 *   4. If the LLM extracts a different orderRef (via injection), the gate blocks it
 *
 * This is the correct real-world design: the user types naturally, the server
 * resolves and commits the intent structurally — the LLM only provides reasoning,
 * not authority to target different resources.
 */
taskRouter.post("/structured", async (req, res) => {
  const parsed = structuredBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid request" });

  const { customerId, ticketText } = parsed.data;

  // Extract the FIRST order ref from the text (e.g. "order 9104" or "#9104")
  const match = ticketText.match(/(?:order\s*#?\s*|#)(\d{4,})/i);
  if (!match) {
    return res.status(400).json({
      error: "No order reference found in your message. Please mention your order number.",
    });
  }
  const orderRef = match[1];

  // Ownership check: validate the extracted orderRef belongs to this customer in the real DB.
  // This is the structural trust anchor — not LLM-parsed, checked against real data.
  const ownerCheck = await pool.query(
    "SELECT 1 FROM orders WHERE order_ref = $1 AND customer_id = $2",
    [orderRef, customerId]
  );
  if (ownerCheck.rows.length === 0) {
    return res.status(403).json({
      error: `Order ${orderRef} does not belong to your account. You can only request refunds for your own orders.`,
    });
  }

  try {
    const result = await handleIncomingStructuredTask({
      sessionId: randomUUID(), // server-minted — never from user input
      customerId,
      orderRef,                // extracted & ownership-validated — never from LLM
      justification: ticketText,
    });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const adminTaskRouter: Router = express.Router();
adminTaskRouter.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid request" });
  try {
    const result = await handleTicket(parsed.data.ticketText);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});