import express from "express";
import cors from "cors";
import { z } from "zod";
import { handleTicket } from "./agent";
import { attackRouter } from "./attacks";

export const app = express();
app.use(cors());
app.use(express.json());

const bodySchema = z.object({
  customerId: z.string().min(1),
  ticketText: z.string().min(1),
});

app.post("/ticket", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid request" });
  try {
    const result = await handleTicket(parsed.data.customerId, parsed.data.ticketText);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Traditional API attack routes - direct parameter manipulation, no LLM involved
app.use("/attack", attackRouter);

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
