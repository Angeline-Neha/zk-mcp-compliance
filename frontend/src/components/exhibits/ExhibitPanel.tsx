/**
 * ExhibitPanel — shared step-through component for all nine attack exhibits.
 *
 * Talks to POST /attack/:id/start then POST /attack/:id/:runId/step/:n
 * Renders step narrations, request/response payloads, and BLOCKED / PASS badges.
 */
import { useState, useCallback } from "react";

const GW = "http://localhost:4006";

export interface ExhibitMeta {
  id: string;            // "1"–"8"
  number: string;        // "I"–"VIII" in roman numerals
  title: string;
  tagline: string;
  dangerVerb: string;    // "NONCE BURNED" / "SCOPE MISMATCH" etc.
}

interface StepInfo { index: number; label: string }

interface RunState {
  runId: string;
  title: string;
  steps: StepInfo[];
  currentStep: number;
  results: StepResult[];
  done: boolean;
}

interface StepResult {
  label: string;
  narration: string;
  request?: unknown;
  response?: unknown;
  blocked?: boolean;
}

interface Props {
  meta: ExhibitMeta;
}

export function ExhibitPanel({ meta }: Props) {
  const [run, setRun] = useState<RunState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const startRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    try {
      const res = await fetch(`${GW}/attack/${meta.id}/start`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();
      setRun({
        runId: body.runId,
        title: body.title,
        steps: body.steps,
        currentStep: 0,
        results: [],
        done: false,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [meta.id]);

  const advanceStep = useCallback(async () => {
    if (!run || run.done) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${GW}/attack/${meta.id}/${run.runId}/step/${run.currentStep}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(await res.text());
      const result: StepResult = await res.json();
      const nextStep = run.currentStep + 1;
      const done = nextStep >= run.steps.length;
      setRun((r) =>
        r ? { ...r, currentStep: nextStep, results: [...r.results, result], done } : r
      );
      setExpanded(run.results.length); // auto-expand the newest result
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [run, meta.id]);

  const reset = useCallback(() => {
    setRun(null);
    setError(null);
    setExpanded(null);
  }, []);

  const lastResult = run?.results[run.results.length - 1];
  const isBlocked = lastResult?.blocked === true;
  const isFinalStep = run?.done;

  return (
    <div className="exhibit-panel">
      {/* ── Header ── */}
      <div className="exhibit-header">
        <div className="exhibit-number">{meta.number}</div>
        <div className="exhibit-titles">
          <h2 className="exhibit-title">{meta.title}</h2>
          <p className="exhibit-tagline">{meta.tagline}</p>
        </div>
        {isFinalStep && isBlocked && (
          <div className="exhibit-verdict exhibit-verdict--blocked">
            <span className="verdict-stamp">BLOCKED</span>
          </div>
        )}
        {isFinalStep && !isBlocked && (
          <div className="exhibit-verdict exhibit-verdict--pass">
            <span className="verdict-stamp">PASSED</span>
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="exhibit-controls">
        {!run ? (
          <button
            className="exhibit-btn exhibit-btn--start"
            onClick={startRun}
            disabled={loading}
          >
            {loading ? "INITIALISING…" : "▶ RUN EXHIBIT"}
          </button>
        ) : (
          <>
            {!run.done && (
              <button
                className="exhibit-btn exhibit-btn--step"
                onClick={advanceStep}
                disabled={loading}
              >
                {loading
                  ? "EXECUTING…"
                  : `STEP ${run.currentStep + 1}/${run.steps.length} — ${run.steps[run.currentStep]?.label}`}
              </button>
            )}
            <button className="exhibit-btn exhibit-btn--reset" onClick={reset}>
              ↺ RESET
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="exhibit-error">⚠ {error}</div>
      )}

      {/* ── Step progress bar ── */}
      {run && (
        <div className="exhibit-progress">
          {run.steps.map((s, i) => (
            <div
              key={i}
              className={`exhibit-progress-pip ${
                i < run.currentStep
                  ? run.results[i]?.blocked
                    ? "pip--blocked"
                    : "pip--done"
                  : i === run.currentStep && !run.done
                  ? "pip--active"
                  : "pip--pending"
              }`}
              title={s.label}
            />
          ))}
        </div>
      )}

      {/* ── Results log ── */}
      {run && run.results.length > 0 && (
        <div className="exhibit-log">
          {run.results.map((r, i) => (
            <div
              key={i}
              className={`exhibit-log-entry ${r.blocked ? "entry--blocked" : "entry--pass"}`}
            >
              <div
                className="log-entry-header"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <span className={`log-step-badge ${r.blocked ? "badge--blocked" : "badge--pass"}`}>
                  {r.blocked ? "■ BLOCKED" : "● PASS"}
                </span>
                <span className="log-step-label">{r.label}</span>
                <span className="log-expand-icon">{expanded === i ? "▲" : "▼"}</span>
              </div>

              {expanded === i && (
                <div className="log-entry-body">
                  <p className="log-narration">{r.narration}</p>
                  {r.request && (
                    <div className="log-payload">
                      <div className="payload-label">REQUEST</div>
                      <pre className="payload-json">{JSON.stringify(r.request, null, 2)}</pre>
                    </div>
                  )}
                  {r.response && (
                    <div className="log-payload">
                      <div className="payload-label">RESPONSE</div>
                      <pre className="payload-json">{JSON.stringify(r.response, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
