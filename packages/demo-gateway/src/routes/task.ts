import express, { Router } from "express";
import { z } from "zod";
import { handleIncomingTask } from "@zk-mcp/orchestrator-agent";
import { handleTicket } from "@zk-mcp/admin-agent";

const bodySchema = z.object({ ticketText: z.string().min(1) });

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