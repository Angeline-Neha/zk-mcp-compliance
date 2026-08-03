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
import { emitStateSequence, deriveStateSequenceFromGateResult, type GateResultLike } from "../lib/requestEvents";
import { recordAttackOutcome, getAllAttackOutcomes } from "../lib/attackResults";
import { saveInspectorSnapshot, type InspectorSnapshot } from "../lib/inspectorStore";
import type { RequestPath } from "../lib/boardState";

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

// Which real tool each exhibit ultimately targets — drives which lane of the
// board (support-agent/finance vs admin-agent/admin-mcp) its events render
// on. Fixed by which script/tool each attack actually calls, not inferred
// from the display title (several deletion-path attacks don't say "delete"
// anywhere in their title).
const ATTACK_PATH: Record<string, RequestPath> = {
  "1": "refund",
  "2": "deletion",
  "3": "refund",
  "4": "deletion",
  "5": "deletion",
  "6": "refund",
  "7": "refund",
  "8": "refund",
  "9": "refund",
};

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

      // Emit this run onto the live Board/Docket directly — we control every
      // step here, so there's no reason to depend on the async audit-log
      // poller (events.ts's startAuditPoll) picking this up indirectly. That
      // indirect path is still what surfaces real Task Interface / Intake
      // traffic; exhibits get their own deterministic, synchronous path.
      const requestId = `attack-${req.params.runId}`;
      const ts = new Date().toISOString();
      const agentId = `attacker-${attack.id}`;
      const response = (result as any)?.response as
        | (GateResultLike & { inspector?: InspectorSnapshot["inspector"]; orderContext?: unknown })
        | undefined;

      // A real gate response (from finance-mcp-server / admin-mcp-server)
      // always carries an `inspector` object. If this run's final step hit a
      // real server, use its ACTUAL proof/reason data for the board + save a
      // real inspector snapshot. Attacks that never reach a server (pure
      // sigma-algebra failures, by design) fall back to a reason-only event
      // with no inspector snapshot — there's nothing real to show.
      const hasRealGateResult = !!response && ("allowed" in response);
      const path = ATTACK_PATH[attack.id] ?? "refund";
      const reason =
        (hasRealGateResult ? response!.reason : null) ??
        (result as any)?.narration ??
        `${attack.title} — blocked`;

      const sequence = hasRealGateResult
        ? deriveStateSequenceFromGateResult(response!, path)
        : ["proof1_fail", "rejected"];

      await emitStateSequence(
        {
          requestId,
          timestamp: ts,
          agentId,
          tool: attack.title,
          reason,
          proof1Hash: null,
          proof2Hash: null,
          policyCommitment: hasRealGateResult ? response!.inspector?.proof2?.policyCommitment ?? null : null,
          docket: { agent: agentId, tool: attack.title, ts: new Date(ts).toTimeString().slice(0, 8) },
        },
        sequence as any,
        { path, reason },
        250
      );

      if (hasRealGateResult && response!.inspector) {
        saveInspectorSnapshot({
          requestId,
          timestamp: ts,
          agentId,
          tool: attack.title,
          state: response!.allowed ? "approved" : "rejected",
          outcome: response!.allowed ? "pass" : "fail",
          failReason: reason,
          policyCommitment: response!.inspector.proof2?.policyCommitment ?? null,
          inspector: response!.inspector,
        });
      }
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