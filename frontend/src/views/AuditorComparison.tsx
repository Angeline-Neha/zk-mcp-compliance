import { useEffect, useState } from "react";
import { fetchAuditLog, type AuditEntry } from "../lib/api";

const FAKE_OAUTH_LOG = {
  timestamp: "2026-07-30T14:22:03.000Z",
  agent_id: "support-agent",
  action: "issue_refund",
  scope: "issue_refund:write",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  request_payload: {
    order_id: "4522",
    amount: 5000,
    customer_email: "j.doe@example.com",
    customer_account_age_days: 46,
    reasoning_trace: "Customer stated urgent need, approving despite policy threshold...",
  },
  result: "approved",
};

export function AuditorComparison() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  useEffect(() => {
    fetchAuditLog(20).then((e) => {
      setEntries(e);
      setSelected(e[0] ?? null);
    });
  }, []);

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-slate-line overflow-y-auto scrollbar-thin shrink-0">
        {entries.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelected(e)}
            className={`w-full text-left px-3 py-2.5 border-b border-slate-line/60 text-xs transition-colors ${
              selected?.id === e.id ? "bg-ink-panel" : "hover:bg-ink-raised/60"
            }`}
          >
            <div className="font-mono-data text-slate-300 truncate">{e.agentId}</div>
            <div className={`font-mono-data ${e.pass ? "text-pass" : "text-fail"}`}>
              {e.pass ? "pass" : "rejected"}
            </div>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        <p className="text-sm text-slate-400 mb-4 max-w-2xl">
          Same incident, two audit trails. The illustrative baseline on the right represents what a
          typical OAuth/JWT-based system's log would contain — full request payloads, tokens, and
          even freeform reasoning traces. This system's real log (left) never stores any of that.
        </p>

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-pass font-display font-medium mb-2">
              This system — real audit_log entry
            </div>
            <pre className="panel p-4 text-xs font-mono-data text-data/90 overflow-x-auto whitespace-pre-wrap">
              {selected ? JSON.stringify(selected, null, 2) : "select an entry"}
            </pre>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-fail font-display font-medium mb-2">
              Illustrative OAuth/JWT baseline
            </div>
            <pre className="panel p-4 text-xs font-mono-data text-fail/70 overflow-x-auto whitespace-pre-wrap border-fail/20">
              {JSON.stringify(FAKE_OAUTH_LOG, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}