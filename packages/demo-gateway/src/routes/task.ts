import express, { Router } from "express";
import { z } from "zod";
import { handleIncomingTask, handleIncomingStructuredTask } from "@zk-mcp/orchestrator-agent";
import { handleTicket } from "@zk-mcp/admin-agent";
import { randomUUID } from "crypto";

const bodySchema = z.object({ ticketText: z.string().min(1) });

const structuredBodySchema = z.object({
  customerId: z.string().min(1),
  orderRef: z.string().min(1),
  justification: z.string().min(1),
});

export const taskRouter: Router = express.Router();
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
 * orderRef is chosen by the user from an authenticated dropdown;
 * justification is free text (and may contain injected instructions).
 * The sessionId is minted here so it's server-controlled, never user-supplied.
 */
taskRouter.post("/structured", async (req, res) => {
  const parsed = structuredBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  try {
    const result = await handleIncomingStructuredTask({
      sessionId: randomUUID(), // server-minted, never from the user
      ...parsed.data,
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