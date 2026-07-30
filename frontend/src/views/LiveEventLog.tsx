import { useEffect, useRef, useState } from "react";
import { fetchAuditLog, subscribeToEvents, type AuditEntry } from "../lib/api";
import { DualProofStrip, type ProofPanelData } from "../components/DualProofStrip";

function entryToProofPanels(entry: AuditEntry): { proof1: ProofPanelData; proof2: ProofPanelData } {
  const proof1Failed = entry.reason?.startsWith("Proof 1") ?? false;
  const proof2Failed = !entry.pass && !proof1Failed;

  return {
    proof1: {
      status: proof1Failed ? "fail" : "pass",
      title: "Proof 1 — Authorization",
      fields: [
        { label: "agent", value: entry.agentId },
        { label: "scope", value: entry.scopeAction },
        { label: "proof hash", value: entry.proof1Hash ?? "—" },
      ],
      reason: proof1Failed ? entry.reason ?? undefined : undefined,
    },
    proof2: {
      status: !entry.proof2Hash ? "idle" : proof2Failed ? "fail" : "pass",
      title: "Proof 2 — Compliance",
      fields: [
        { label: "tool", value: entry.toolName },
        { label: "proof hash", value: entry.proof2Hash ?? "—" },
        { label: "policy commitment", value: entry.policyCommitment ?? "—" },
      ],
      reason: proof2Failed ? entry.reason ?? undefined : undefined,
    },
  };
}

export function LiveEventLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    fetchAuditLog(50).then((initial) => {
      setEntries(initial);
      initial.forEach((e) => seenIds.current.add(e.id));
    });

    const unsubscribe = subscribeToEvents((entry) => {
      if (seenIds.current.has(entry.id)) return;
      seenIds.current.add(entry.id);
      setEntries((prev) => [entry, ...prev].slice(0, 100));
    });

    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-line flex items-center justify-between">
        <h2 className="font-display font-semibold text-sm uppercase tracking-widest text-slate-300">
          Live Event Log
        </h2>
        <span className="text-xs font-mono-data text-slate-500">{entries.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {entries.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm font-mono-data">
            No events yet — submit a task or run an attack to see live proof attempts appear here.
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="border-b border-slate-line/60">
            <button
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-ink-raised/60 text-left transition-colors"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.pass ? "bg-pass" : "bg-fail"}`}
              />
              <span className="font-mono-data text-sm text-slate-200 truncate">{entry.agentId}</span>
              <span className="font-mono-data text-xs text-slate-500 truncate">{entry.toolName}</span>
              <span
                className={`ml-auto text-xs font-mono-data ${entry.pass ? "text-pass" : "text-fail"}`}
              >
                {entry.pass ? "PASS" : "REJECTED"}
              </span>
              <span className="text-xs font-mono-data text-slate-600 shrink-0 w-20 text-right">
                {new Date(entry.createdAt).toLocaleTimeString()}
              </span>
            </button>

            {expandedId === entry.id && (
              <div className="px-4 pb-4 pt-1">
                {!entry.pass && entry.reason && (
                  <p className="text-xs font-mono-data text-fail/80 mb-3">{entry.reason}</p>
                )}
                <DualProofStrip {...entryToProofPanels(entry)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}