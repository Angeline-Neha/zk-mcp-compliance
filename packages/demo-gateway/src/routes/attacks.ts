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
import { salamiSlicingAttack } from "../attackSteps/salamiSlicing";
import { AttackDefinition, buildInitialState } from "../attackSteps/types";
import { emitStateSequence } from "../lib/requestEvents";
import { recordAttackOutcome, getAllAttackOutcomes } from "../lib/attackResults";

const ATTACKS: Record<string, AttackDefinition> = {
  "1": replayAttack,
  "2": confusedDeputyAttack,
  "3": escalationAttack,
  "4": lateralMovementAttack,
  "5": crossServerReuseAttack,
  "6": toctouAttack,
  "7": fakeComplianceProofAttack,
  "8": intentInjectionAttack,
  "9": salamiSlicingAttack,
};

// These attacks verify proof/protocol logic in isolation and never call a real
// MCP server's /mcp endpoint, so they never write an audit_log row and never
// surface on the live Board/Docket by themselves. All five are genuinely
// Proof-1/authorization-layer failures per the attack table, so we emit a
// synthetic proof1_fail → rejected board event on their final step.
// Ids 5 and 7 already hit the real gate (real audit row); 8 and 9 now run
// through the actual Intake ticket flow instead of this route.
const NEEDS_SYNTHETIC_BOARD_EVENT = new Set(["1", "2", "3", "4", "6"]);

export const attacksRouter: Router = express.Router();

attacksRouter.post("/:id/start", (req, res) => {
  const attack = ATTACKS[req.params.id];
  if (!attack) return res.status(404).json({ error: "unknown attack id" });
  const config = req.body ?? {};
  const initialState = buildInitialState(attack, config);
  const runId = createRun(attack.id, initialState);
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

    const isFinalStep = stepIndex === attack.steps.length - 1;
    if (isFinalStep) {
      recordAttackOutcome(attack.id, (result as any)?.blocked === true, (result as any)?.narration);
    }

    if (NEEDS_SYNTHETIC_BOARD_EVENT.has(attack.id) && isFinalStep) {
      const ts = new Date().toISOString();
      const reason = (result as any)?.narration ?? `${attack.title} blocked by Proof 1 checks`;
      await emitStateSequence(
        {
          requestId: `attack-${req.params.runId}`,
          timestamp: ts,
          agentId: `attacker-${attack.id}`,
          tool: attack.title,
          reason,
          proof1Hash: null,
          proof2Hash: null,
          policyCommitment: null,
          docket: { agent: `attacker-${attack.id}`, tool: attack.title, ts: new Date(ts).toTimeString().slice(0, 8) },
        },
        ["proof1_fail", "rejected"],
        { path: "refund", reason },
        250
      );
    }

    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backs the Auditor Dashboard's "Red Team Attack Outcomes" scoreboard —
// real per-attack status from actual completed runs, not a static assumption.
attacksRouter.get("/results", (_req, res) => {
  res.status(200).json({ outcomes: getAllAttackOutcomes(Object.keys(ATTACKS)) });
});