import { useEffect, useState } from "react";
import { fetchAuditLog, AuditEntry } from "../../lib/api";

/** Last 200 audit-log rows, refreshed every 6 seconds. `error` is true if the issuer is unreachable. */
export function useAuditEntries(intervalMs = 6000) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchAuditLog(200)
        .then((e) => {
          if (cancelled) return;
          setEntries(e);
          setError(false);
        })
        .catch(() => !cancelled && setError(true));
    };
    load();
    const iv = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [intervalMs]);

  return { entries, error };
}

interface CardProps {
  entries: AuditEntry[] | null;
  error: boolean;
}

function Empty({ entries, error }: CardProps) {
  return (
    <p style={{ fontSize: 13, opacity: 0.6, margin: "8px 0 0" }}>
      {error && !entries ? "Audit log unavailable. Is the issuer service running?" : entries === null ? "Loading…" : "No audit entries yet."}
    </p>
  );
}

export function LatestDecisions({ entries, error }: CardProps) {
  const rows = (entries ?? []).slice(0, 8);
  return (
    <div className="zk-card" style={{ height: "100%" }}>
      <h3 className="zk-card-title">Latest decisions</h3>
      <p className="zk-card-sub">Most recent audit-log entries.</p>
      {rows.length === 0 && <Empty entries={entries} error={error} />}
      {rows.map((e) => (
        <div
          key={e.id}
          style={{
            display: "grid",
            gridTemplateColumns: "10px minmax(0, 1fr) auto",
            gap: 10,
            alignItems: "center",
            padding: "8px 0",
            borderTop: "1px solid var(--zk-rule)",
          }}
        >
          <i style={{ width: 10, height: 10, borderRadius: "50%", background: e.pass ? "#839958" : "#A8362C" }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", font: "500 12.5px var(--zk-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {e.toolName}
            </span>
            <span style={{ display: "block", fontSize: 11.5, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.reason ?? undefined}>
              {e.agentId}
              {!e.pass && e.reason ? ` · ${e.reason}` : ""}
            </span>
          </span>
          <span style={{ font: "400 11px var(--zk-mono)", opacity: 0.55 }}>
            {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BlockedReasons({ entries, error }: CardProps) {
  const counts = new Map<string, number>();
  (entries ?? []).filter((e) => !e.pass).forEach((e) => {
    const k = e.reason?.trim() || "unspecified";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = rows[0]?.[1] ?? 1;

  return (
    <div className="zk-card" style={{ height: "100%" }}>
      <h3 className="zk-card-title">Why requests were blocked</h3>
      <p className="zk-card-sub">Failure reasons across the last {entries?.length ?? 0} audit entries.</p>
      {rows.length === 0 && (entries === null || error ? <Empty entries={entries} error={error} /> : <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>No blocked requests yet.</p>)}
      {rows.map(([reason, n]) => (
        <div key={reason} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={reason}>{reason}</span>
            <b style={{ font: "500 12.5px var(--zk-mono)" }}>{n}</b>
          </div>
          <div className="zk-bar"><span style={{ width: `${(n / max) * 100}%`, background: "#A8362C" }} /></div>
        </div>
      ))}
    </div>
  );
}

export function AgentPassRates({ entries, error }: CardProps) {
  const byAgent = new Map<string, { pass: number; fail: number }>();
  (entries ?? []).forEach((e) => {
    const a = byAgent.get(e.agentId) ?? { pass: 0, fail: 0 };
    e.pass ? a.pass++ : a.fail++;
    byAgent.set(e.agentId, a);
  });
  const rows = [...byAgent.entries()].sort((a, b) => b[1].pass + b[1].fail - (a[1].pass + a[1].fail));

  return (
    <div className="zk-card" style={{ height: "100%" }}>
      <h3 className="zk-card-title">Pass rate by agent</h3>
      <p className="zk-card-sub">Verified versus blocked requests per agent.</p>
      {rows.length === 0 && <Empty entries={entries} error={error} />}
      {rows.map(([agent, c]) => {
        const total = c.pass + c.fail;
        return (
          <div key={agent} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ font: "500 12.5px var(--zk-mono)" }}>{agent}</span>
              <span style={{ font: "400 12px var(--zk-mono)", opacity: 0.7 }}>{c.pass}/{total} passed</span>
            </div>
            <div className="zk-bar">
              <span style={{ width: `${(c.pass / total) * 100}%`, background: "#839958" }} />
              <span style={{ width: `${(c.fail / total) * 100}%`, background: "#A8362C" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
