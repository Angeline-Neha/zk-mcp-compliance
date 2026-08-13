import express, { Router } from "express";
import { runBaselineRedTeamAttack, OBJECTIVES } from "@zk-mcp/baseline-red-team-agent";

export const baselineRedTeamRouter: Router = express.Router();

baselineRedTeamRouter.get("/objectives", (_req, res) => {
  res.status(200).json({ objectives: OBJECTIVES });
});

baselineRedTeamRouter.post("/:id/run", async (req, res) => {
  const attackId = req.params.id;
  if (!OBJECTIVES.some((o) => o.id === attackId)) {
    return res.status(404).json({ error: "unknown attack id — baseline-red-team-agent covers attacks 1-7 only" });
  }
  try {
    const run = await runBaselineRedTeamAttack(attackId);
    res.status(200).json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? String(err) });
  }
});
