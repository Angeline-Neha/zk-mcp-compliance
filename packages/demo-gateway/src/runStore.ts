interface RunEntry {
  attackId: string;
  stepIndex: number;
  state: unknown;
}

const runs = new Map<string, RunEntry>();

export function createRun(attackId: string, initialState: unknown): string {
  const runId = crypto.randomUUID();
  runs.set(runId, { attackId, stepIndex: 0, state: initialState });
  return runId;
}

export function getRun(runId: string): RunEntry | undefined {
  return runs.get(runId);
}

export function advanceRun(runId: string, newState: unknown): void {
  const run = runs.get(runId);
  if (run) {
    run.stepIndex++;
    run.state = newState;
  }
}