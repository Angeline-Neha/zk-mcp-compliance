import { useState } from "react";
import { submitTask, submitAdminTask, type TaskResult, type ToolCall } from "../lib/api";
import { DualProofStrip, type ProofPanelData } from "../components/DualProofStrip";

function toolCallToProofPanels(call: ToolCall): { proof1: ProofPanelData; proof2: ProofPanelData } | null {
  if (call.tool !== "request_refund" && call.tool !== "request_deletion") return null;
  const result = call.result as { allowed?: boolean; reason?: string } | undefined;
  if (!result || typeof result.allowed !== "boolean") return null;

  const proof1Failed = result.reason?.startsWith("Proof 1") ?? false;
  const proof2Failed = !result.allowed && !proof1Failed;

  return {
    proof1: {
      status: proof1Failed ? "fail" : "pass",
      title: "Proof 1 — Authorization",
      fields: [{ label: "tool", value: call.tool }],
      reason: proof1Failed ? result.reason : undefined,
    },
    proof2: {
      status: result.allowed ? "pass" : proof2Failed ? "fail" : "idle",
      title: "Proof 2 — Compliance",
      fields: [{ label: "outcome", value: result.allowed ? "approved" : "blocked" }],
      reason: proof2Failed ? result.reason : undefined,
    },
  };
}

export function TaskInterface() {
  const [ticketText, setTicketText] = useState("");
  const [target, setTarget] = useState<"refund" | "deletion">("refund");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!ticketText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRevealedCount(0);
    try {
      const res = target === "refund" ? await submitTask(ticketText) : await submitAdminTask(ticketText);
      setResult(res);
      res.toolCalls.forEach((_, i) => {
        setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), i * 450);
      });
    } catch (err: any) {
      setError(err.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-line flex items-center gap-3">
        <h2 className="font-display font-semibold text-sm uppercase tracking-widest text-slate-300">
          Task Interface
        </h2>
        <div className="ml-auto flex gap-1 text-xs font-mono-data">
          <button
            onClick={() => setTarget("refund")}
            className={`px-2 py-1 rounded border ${
              target === "refund" ? "border-pass text-pass" : "border-slate-structure text-slate-500"
            }`}
          >
            orchestrator (refund)
          </button>
          <button
            onClick={() => setTarget("deletion")}
            className={`px-2 py-1 rounded border ${
              target === "deletion" ? "border-pass text-pass" : "border-slate-structure text-slate-500"
            }`}
          >
            admin-agent (deletion)
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-line flex gap-2">
        <input
          value={ticketText}
          onChange={(e) => setTicketText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={
            target === "refund"
              ? "e.g. refund order 4521, it arrived damaged"
              : "e.g. delete my account acct-002, do it now"
          }
          className="flex-1 bg-ink-panel border border-slate-line rounded px-3 py-2 text-sm font-mono-data text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-data/50"
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-pass/10 border border-pass/40 text-pass text-sm font-display font-medium rounded hover:bg-pass/20 disabled:opacity-40 transition-colors"
        >
          {loading ? "Running…" : "Submit"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {error && (
          <div className="panel p-3 border-fail/40 text-fail text-sm font-mono-data">{error}</div>
        )}

        {result?.toolCalls.slice(0, revealedCount).map((call, i) => {
          const proofData = toolCallToProofPanels(call);
          return (
            <div key={i} className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono-data text-data">{call.tool}</span>
                <span className="text-xs font-mono-data text-slate-500 truncate">
                  {JSON.stringify(call.input)}
                </span>
              </div>
              {proofData ? (
                <DualProofStrip {...proofData} />
              ) : (
                <pre className="text-xs font-mono-data text-slate-400 overflow-x-auto">
                  {JSON.stringify(call.result, null, 2)}
                </pre>
              )}
            </div>
          );
        })}

        {result && revealedCount >= result.toolCalls.length && (
          <div className="panel p-4 border-data/30">
            <span className="text-[10px] uppercase tracking-wide text-data/70 font-display">
              final response
            </span>
            <p className="text-sm text-slate-200 mt-1">{result.finalResponse}</p>
          </div>
        )}
      </div>
    </div>
  );
}