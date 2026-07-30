import express, { Router } from "express";
import { createRun, getRun, advanceRun } from "../runStore";
import { replayAttack } from "../attackSteps/replay";
import { confusedDeputyAttack } from "../attackSteps/confusedDeputy";
import { escalationAttack } from "../attackSteps/escalation";
import { lateralMovementAttack } from "../attackSteps/lateralMovement";
import { crossServerReuseAttack } from "../attackSteps/crossServerReuse";
import { toctouAttack } from "../attackSteps/toctou";
import { fakeComplianceProofAttack } from "../attackSteps/fakeComplianceProof";
import { intentInjectionAttack } from "../attackSteps/intentInjection";
import { AttackDefinition } from "../attackSteps/types";

const ATTACKS: Record<string, AttackDefinition> = {
  "1": replayAttack,
  "2": confusedDeputyAttack,
  "3": escalationAttack,
  "4": lateralMovementAttack,
  "5": crossServerReuseAttack,
  "6": toctouAttack,
  "7": fakeComplianceProofAttack,
  "8": intentInjectionAttack,
};

export const attacksRouter: Router = express.Router();

attacksRouter.post("/:id/start", (req, res) => {
  const attack = ATTACKS[req.params.id];
  if (!attack) return res.status(404).json({ error: "unknown attack id" });
  const runId = createRun(attack.id, attack.initialState);
  res.status(201).json({
    runId,
    title: attack.title,
    steps: attack.steps.map((s, i) => ({ index: i, label: s.label })),
  });
});

attacksRouter.post("/:id/:runId/step/:n", async (req, res) => {
  const attack = ATTACKS[req.params.id];
  const run = getRun(req.params.runId);
  const stepIndex = Number(req.params.n);
  if (!attack || !run || run.attackId !== attack.id) {
    return res.status(404).json({ error: "run not found" });
  }
  if (stepIndex !== run.stepIndex) {
    return res.status(409).json({ error: `expected step ${run.stepIndex}, got ${stepIndex}` });
  }

  const step = attack.steps[stepIndex];
  if (!step) return res.status(400).json({ error: "no such step" });

  try {
    const { result, newState } = await step.run(run.state);
    advanceRun(req.params.runId, newState);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});