import { useEffect, useRef, useState } from "react";
import { fetchDbSnapshot, DbSnapshot, DbTableSnapshot } from "../../lib/api";

const POLL_MS = 2000;

/**
 * Live, read-only view into every table in the Docker Postgres instance,
 * polled every 2s. Lets an auditor watch rows appear in real time as
 * tasks/attacks run (attestations issued, nonces burned, refunds written,
 * revocations logged) instead of trusting a static after-the-fact summary.
 *
 */
export function LiveDatabasePanel() {
  const [snapshot, setSnapshot] = useState<DbSnapshot | null>(null);
  const [selected, setSelected] = useState<string>("attestations");
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const prevCounts = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchDbSnapshot();
        if (cancelled) return;

        const changed = new Set<string>();
        for (const t of data.tables) {
          const prev = prevCounts.current[t.key];
          if (prev !== undefined && t.count !== prev) changed.add(t.key);
          prevCounts.current[t.key] = t.count;
        }
        if (changed.size > 0) {
          setFlashKeys(changed);
          setTimeout(() => setFlashKeys(new Set()), 900);
        }
        setSnapshot(data);
      } catch {
        /* gateway or DB unreachable — keep last known snapshot on screen */
      }
    }

    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const activeTable: DbTableSnapshot | undefined = snapshot?.tables.find((t) => t.key === selected);
  const columns = activeTable?.latest?.[0] ? Object.keys(activeTable.latest[0]) : [];

  return (
    <div className="zk-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div>
          <h3 className="zk-card-title">Live database</h3>
          <p className="zk-card-sub" style={{ margin: 0 }}>Every table in the Postgres instance, read-only.</p>
        </div>
        <span className="zk-pill zk-pill--up" style={{ flexShrink: 0 }}>
          <i />
          Polling every {POLL_MS / 1000}s
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 14 }}>
        {(snapshot?.tables ?? []).map((t) => (
          <button
            key={t.key}
            onClick={() => setSelected(t.key)}
            className={`zk-tab${selected === t.key ? " zk-tab--on" : ""}${flashKeys.has(t.key) ? " zk-tab--flash" : ""}`}
          >
            <div style={{ fontSize: 11.5, opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</div>
            <div style={{ font: "500 20px var(--zk-mono)" }}>{t.ok ? t.count : "—"}</div>
          </button>
        ))}
      </div>

      {activeTable && (
        <div style={{ font: "400 12px var(--zk-mono)", opacity: 0.65, marginBottom: 8 }}>
          showing {activeTable.latest.length} of {activeTable.count} rows
        </div>
      )}
      <div style={{ overflow: "auto", maxHeight: 420, border: "1px solid var(--zk-rule)", borderRadius: 8 }}>
        <table className="zk-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c.replace(/_/g, " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeTable?.ok === false && (
              <tr>
                <td style={{ color: "#A8362C" }}>table not available yet (migration not run in this environment)</td>
              </tr>
            )}
            {activeTable?.latest.length === 0 && activeTable.ok && (
              <tr>
                <td style={{ opacity: 0.55 }}>no rows yet</td>
              </tr>
            )}
            {activeTable?.latest.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c}>{formatCell(row[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleTimeString();
  }
  return String(v);
}