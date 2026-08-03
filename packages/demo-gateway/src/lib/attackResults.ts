/**
 * Tracks the outcome of each exhibit's most recently COMPLETED run, in this
 * server process's memory. This is what backs the Auditor Dashboard's
 * "Red Team Attack Outcomes" scoreboard — it reflects runs that actually
 * happened via POST /attack/:id/start + /step, not a hardcoded assumption
 * that every attack has already been run and blocked.
 *
 * Intentionally in-memory and unpersisted: a server restart resets the
 * board, which is the right behavior for a live demo — nobody should see
 * "blocked" for an attack nobody has run yet against the current process.
 */

export type AttackOutcomeStatus = "not_run" | "blocked" | "passed";

export interface AttackOutcome {
  status: AttackOutcomeStatus;
  lastRunAt: string | null;
  lastReason: string | null;
}

const outcomes = new Map<string, AttackOutcome>();

export function recordAttackOutcome(attackId: string, blocked: boolean, reason?: string): void {
  outcomes.set(attackId, {
    status: blocked ? "blocked" : "passed",
    lastRunAt: new Date().toISOString(),
    lastReason: reason ?? null,
  });
}

export function getAttackOutcome(attackId: string): AttackOutcome {
  return outcomes.get(attackId) ?? { status: "not_run", lastRunAt: null, lastReason: null };
}

export function getAllAttackOutcomes(attackIds: string[]): Record<string, AttackOutcome> {
  const result: Record<string, AttackOutcome> = {};
  for (const id of attackIds) result[id] = getAttackOutcome(id);
  return result;
}
