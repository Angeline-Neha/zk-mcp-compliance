import { Router } from "express";
import { getInspectorSnapshot } from "../lib/inspectorStore";

const ISSUER_URL = process.env.ISSUER_URL ?? "http://localhost:4001";

export const inspectorRouter: Router = Router();

inspectorRouter.get("/:requestId", async (req, res) => {
  const { requestId } = req.params;

  const stored = getInspectorSnapshot(requestId);
  if (stored) {
    return res.status(200).json(stored);
  }

  // Fallback: audit-log entry (attack traffic / older requests)
  try {
    const r = await fetch(`${ISSUER_URL}/audit-log?limit=100`);
    if (!r.ok) return res.status(404).json({ error: "inspector snapshot not found" });
    const { entries } = await r.json();
    const entry = entries?.find((e: { id: string }) => e.id === requestId);
    if (!entry) return res.status(404).json({ error: "inspector snapshot not found" });

    return res.status(200).json({
      requestId: entry.id,
      timestamp: entry.createdAt,
      agentId: entry.agentId,
      tool: entry.toolName ?? "unknown",
      state: entry.pass ? "approved" : "rejected",
      outcome: entry.pass ? "pass" : "fail",
      failReason: entry.reason,
      proof1Hash: entry.proof1Hash,
      proof2Hash: entry.proof2Hash,
      policyCommitment: entry.policyCommitment,
      inspector: null,
      partial: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "lookup failed";
    return res.status(500).json({ error: msg });
  }
});
