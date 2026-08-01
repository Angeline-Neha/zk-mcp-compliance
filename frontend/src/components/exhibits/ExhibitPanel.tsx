/**
 * ExhibitPanel — shared step-through component for all nine attack exhibits.
 *
 * Exhibits with a `params` schema show a "configure" panel first — real
 * seeded orders and numeric knobs the user can change — before "Run".
 * Talks to POST /attack/:id/start (with the chosen config as JSON body)
 * then POST /attack/:id/:runId/step/:n. Renders step narrations,
 * request/response payloads, and BLOCKED / PASS badges.
 */
import { useState, useCallback, useEffect } from "react";
import { GATEWAY_URL, fetchOrders, OrderOption } from "../../lib/api";

const GW = GATEWAY_URL;

export interface ParamDef {
  key: string;
  label: string;
  type: "orderRef" | "number" | "text";
  default: string | number;
  help?: string;
  min?: number;
  category?: "pass" | "fail";
}

export interface ExhibitMeta {
  id: string;            // "1"–"9"
  number: string;        // "I"–"IX" in roman numerals
  title: string;
  tagline: string;
  dangerVerb: string;    // "NONCE BURNED" / "SCOPE MISMATCH" etc.
  params?: ParamDef[];   // editable inputs shown before "Run", if any
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
  request?: any;
  response?: any;
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
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [config, setConfig] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    (meta.params ?? []).forEach((p) => { init[p.key] = p.default; });
    return init;
  });

  useEffect(() => {
    if (meta.params?.some((p) => p.type === "orderRef")) {
      fetchOrders().then(setOrders).catch(() => setOrders([]));
    }
  }, [meta.id]);

  const updateConfig = useCallback((key: string, value: string | number) => {
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);

  const startRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    try {
      const res = await fetch(`${GW}/attack/${meta.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
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
  }, [meta.id, config]);

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

  const orderOptions = (category?: "pass" | "fail") =>
    category ? orders.filter((o) => o.category === category) : orders;

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

      {/* ── Configure panel (only when this exhibit exposes params, and before a run starts) ── */}
      {!run && meta.params && meta.params.length > 0 && (
        <div className="exhibit-config">
          <div className="exhibit-config-header">CONFIGURE THIS RUN</div>
          <div className="exhibit-config-grid">
            {meta.params.map((p) => (
              <div key={p.key} className="exhibit-config-field">
                <label className="exhibit-config-label" htmlFor={`cfg-${meta.id}-${p.key}`}>
                  {p.label}
                </label>
                {p.type === "orderRef" ? (
                  <select
                    id={`cfg-${meta.id}-${p.key}`}
                    className="exhibit-config-input"
                    value={config[p.key]}
                    onChange={(e) => updateConfig(p.key, e.target.value)}
                  >
                    {orderOptions(p.category).length === 0 && (
                      <option value={config[p.key]}>{String(config[p.key])} (loading real orders…)</option>
                    )}
                    {orderOptions(p.category).map((o) => (
                      <option key={o.orderRef} value={o.orderRef}>
                        {o.orderRef} — ${o.amount} ({o.category === "pass" ? "compliant" : "non-compliant"})
                      </option>
                    ))}
                  </select>
                ) : p.type === "number" ? (
                  <input
                    id={`cfg-${meta.id}-${p.key}`}
                    className="exhibit-config-input"
                    type="number"
                    min={p.min}
                    value={config[p.key]}
                    onChange={(e) => updateConfig(p.key, Number(e.target.value))}
                  />
                ) : (
                  <input
                    id={`cfg-${meta.id}-${p.key}`}
                    className="exhibit-config-input"
                    type="text"
                    value={config[p.key]}
                    onChange={(e) => updateConfig(p.key, e.target.value)}
                  />
                )}
                {p.help && <p className="exhibit-config-help">{p.help}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

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
              ↺ RESET{meta.params && meta.params.length > 0 ? " & RECONFIGURE" : ""}
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
                  {!!r.request && (
                    <div className="log-payload">
                      <div className="payload-label">REQUEST</div>
                      <pre className="payload-json">{JSON.stringify(r.request, null, 2)}</pre>
                    </div>
                  )}
                  {!!r.response && (
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
