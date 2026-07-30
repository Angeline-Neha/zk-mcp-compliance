import { useState } from "react";
import { ATTACKS, startAttack, runAttackStep, type AttackStartResponse, type StepResult } from "../lib/api";

interface RunState {
  runId: string;
  steps: { index: number; label: string }[];
  completedSteps: StepResult[];
  currentIndex: number;
}

export function AttackControlPanel() {
  const [selectedAttack, setSelectedAttack] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart(attackId: string) {
    setSelectedAttack(attackId);
    setRun(null);
    setError(null);
    setLoading(true);
    try {
      const started: AttackStartResponse = await startAttack(attackId);
      setRun({ runId: started.runId, steps: started.steps, completedSteps: [], currentIndex: 0 });
    } catch (err: any) {
      setError(err.message ?? "Failed to start attack");
    } finally {
      setLoading(false);
    }
  }

  async function handleNextStep() {
    if (!run || !selectedAttack) return;
    setLoading(true);
    setError(null);
    try {
      const result = await runAttackStep(selectedAttack, run.runId, run.currentIndex);
      setRun({
        ...run,
        completedSteps: [...run.completedSteps, result],
        currentIndex: run.currentIndex + 1,
      });
    } catch (err: any) {
      setError(err.message ?? "Step failed");
    } finally {
      setLoading(false);
    }
  }

  const isComplete = run && run.currentIndex >= run.steps.length;

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-slate-line overflow-y-auto scrollbar-thin shrink-0">
        {ATTACKS.map((a) => (
          <button
            key={a.id}
            onClick={() => handleStart(a.id)}
            className={`w-full text-left px-3 py-3 border-b border-slate-line/60 text-xs transition-colors ${
              selectedAttack === a.id ? "bg-ink-panel" : "hover:bg-ink-raised/60"
            }`}
          >
            <div className="font-mono-data text-data">#{a.id}</div>
            <div className="font-display text-slate-300 mt-0.5">{a.title}</div>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {!run && !loading && (
          <div className="text-center text-slate-500 text-sm font-mono-data mt-12">
            Select an attack on the left to begin a live, step-by-step walkthrough.
            <br />
            Each step is a real request against the running system — nothing is precomputed.
          </div>
        )}

        {error && <div className="panel p-3 border-fail/40 text-fail text-sm font-mono-data mb-4">{error}</div>}

        {run && (
          <div className="space-y-3 max-w-2xl">
            {run.steps.map((step, i) => {
              const completed = run.completedSteps[i];
              const isPending = i > run.currentIndex;

              return (
                <div
                  key={step.index}
                  className={`panel p-4 transition-opacity ${
                    isPending ? "opacity-30" : ""
                  } ${completed?.blocked ? "border-fail/50" : completed ? "border-pass/40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-data text-slate-500 w-6">{i + 1}.</span>
                    <span className="text-sm font-display text-slate-200">{step.label}</span>
                    {completed?.blocked && (
                      <span className="ml-auto text-[10px] font-mono-data px-2 py-0.5 border border-fail/50 text-fail rounded">
                        BLOCKED
                      </span>
                    )}
                  </div>

                  {completed && (
                    <div className="mt-2 pl-8">
                      <p className="text-sm text-slate-300 mb-2">{completed.narration}</p>
                      {completed.response !== undefined && (
                        <pre className="text-xs font-mono-data text-data/80 bg-ink rounded p-2 overflow-x-auto">
                          {JSON.stringify(completed.response, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!isComplete && (
              <button
                onClick={handleNextStep}
                disabled={loading}
                className="w-full py-3 bg-data/10 border border-data/40 text-data text-sm font-display font-medium rounded hover:bg-data/20 disabled:opacity-40 transition-colors"
              >
                {loading ? "Running step…" : `Run step ${run.currentIndex + 1} of ${run.steps.length} →`}
              </button>
            )}

            {isComplete && (
              <div className="text-center text-xs font-mono-data text-slate-500 py-2">
                Attack sequence complete.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}