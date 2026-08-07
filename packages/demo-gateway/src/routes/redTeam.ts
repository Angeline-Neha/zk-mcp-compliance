import express, { Router } from "express";
import { runRedTeamAttack, OBJECTIVES } from "@zk-mcp/red-team-agent";
import { emitStateSequence, deriveStateSequenceFromGateResult, type GateResultLike } from "../lib/requestEvents";
import { saveInspectorSnapshot, type InspectorSnapshot } from "../lib/inspectorStore";
import { recordAttackOutcome } from "../lib/attackResults";
import type { RequestPath } from "../lib/boardState";

// Same lane mapping as the scripted exhibits (attacksRouter) — fixed by
// which real tool each attack ultimately targets.
const ATTACK_PATH: Record<string, RequestPath> = {
  "1": "refund",
  "2": "deletion",
  "3": "refund",
  "4": "deletion",
  "5": "deletion",
  "6": "refund",
  "7": "refund",
};

export const redTeamRouter: Router = express.Router();

redTeamRouter.get("/objectives", (_req, res) => {
  res.status(200).json({ objectives: OBJECTIVES });
});

redTeamRouter.post("/:id/run", async (req, res) => {
  const attackId = req.params.id;
  if (!OBJECTIVES.some((o) => o.id === attackId)) {
    return res.status(404).json({ error: "unknown attack id — red-team-agent covers attacks 1-7 only" });
  }

  try {
    const run = await runRedTeamAttack(attackId);

    // If the agent's transcript reached a real gate call (call_mcp_tool
    // against issue_refund/delete_account), land its actual response on the
    // live Board/Docket the same way the scripted exhibits do. If it never
    // got that far (blocked earlier, e.g. at verify_proof1 or delegate_scope),
    // emit a reason-only event — there's no real gate response to show.
    const lastGateCall = [...run.toolCalls].reverse().find((t) => t.tool === "call_mcp_tool");
    const gateResponse = (lastGateCall?.result as any)?.result as
      | (GateResultLike & { inspector?: InspectorSnapshot["inspector"] })
      | undefined;
    const hasRealGateResult = !!gateResponse && "allowed" in gateResponse;

    const requestId = `redteam-${attackId}-${Date.now()}`;
    const ts = new Date().toISOString();
    const agentId = `red-team-agent-${attackId}`;
    const path = ATTACK_PATH[attackId] ?? "refund";
    const title = `Red Team Agent — ${run.title}`;
    const reason = (hasRealGateResult ? gateResponse!.reason : run.finalResponse.slice(0, 200)) ?? "no reason returned";

    // Feed the Auditor Dashboard's Scoreboard the same way the scripted
    // Exhibits runs do, so attacks fired live from the Intake Desk show up
    // there too instead of only ever reading "NOT RUN".
    recordAttackOutcome(attackId, run.blocked, reason);

    const sequence = hasRealGateResult
      ? deriveStateSequenceFromGateResult(gateResponse!, path)
      : run.blocked
        ? ["proof1_fail", "rejected"]
        : ["proof1_pass", "proof2_pass", "approved"];

    await emitStateSequence(
      {
        requestId,
        timestamp: ts,
        agentId,
        tool: title,
        reason,
        proof1Hash: null,
        proof2Hash: null,
        policyCommitment: hasRealGateResult ? gateResponse!.inspector?.proof2?.policyCommitment ?? null : null,
        docket: { agent: agentId, tool: title, ts: new Date(ts).toTimeString().slice(0, 8) },
      },
      sequence as any,
      { path, reason },
      250
    );

    if (hasRealGateResult && gateResponse!.inspector) {
      saveInspectorSnapshot({
        requestId,
        timestamp: ts,
        agentId,
        tool: title,
        state: gateResponse!.allowed ? "approved" : "rejected",
        outcome: gateResponse!.allowed ? "pass" : "fail",
        failReason: reason,
        policyCommitment: gateResponse!.inspector.proof2?.policyCommitment ?? null,
        inspector: gateResponse!.inspector,
      } as InspectorSnapshot);
    }

    res.status(200).json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? String(err) });
  }
});
