import { useEffect, useRef, useState } from "react";
import { fetchDbSnapshot, DbSnapshot, DbTableSnapshot } from "../../lib/api";

const POLL_MS = 2000;

/**
 * Live, read-only view into every table in the Docker Postgres instance,
 * polled every 2s. Lets an auditor watch rows appear in real time as
 * tasks/attacks run (attestations issued, nonces burned, refunds written,
 * revocations logged) instead of trusting a static after-the-fact summary.
 *
 * Replaces AuthorityTree + ScopeCoverageMatrix on the auditor dashboard —
 * those show internal data-structure shape; this shows the actual database
 * changing, which is easier for a non-technical viewer to follow.
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
    <div className="bg-[#1E1530] border border-[rgba(233,228,242,0.15)] rounded-sm p-5 h-full">
      <div className="flex items-center justify-between border-b border-[rgba(233,228,242,0.1)] pb-2 mb-4">
        <h3 className="font-stamp text-lg text-[#E9E4F2] uppercase tracking-widest">Live Database</h3>
        <div className="flex items-center gap-2 font-mono-data text-[9px] uppercase text-[#54C99A]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#54C99A] animate-pulse" />
          Polling every {POLL_MS / 1000}s
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {(snapshot?.tables ?? []).map((t) => (
          <button
            key={t.key}
            onClick={() => setSelected(t.key)}
            className={`text-left p-2 rounded-sm border transition-colors ${
              selected === t.key
                ? "border-[#54C99A] bg-[rgba(84,201,154,0.08)]"
                : "border-[rgba(233,228,242,0.12)] hover:bg-[rgba(233,228,242,0.03)]"
            } ${flashKeys.has(t.key) ? "bg-[rgba(84,201,154,0.18)]" : ""}`}
            style={{ transition: "background-color 0.3s ease" }}
          >
            <div className="font-mono-data text-[9px] uppercase text-[#E9E4F2] opacity-60 truncate">{t.label}</div>
            <div className="font-stamp text-xl text-[#E9E4F2]">{t.ok ? t.count : "—"}</div>
          </button>
        ))}
      </div>

      {activeTable && (
        <div className="font-mono-data text-[10px] text-[#E9E4F2] opacity-60 mb-2">
          showing {activeTable.latest.length} of {activeTable.count} rows
        </div>
      )}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 420 }}>
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#1E1530]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="p-2 border-b border-[rgba(233,228,242,0.2)] font-mono-data text-[10px] text-[#E9E4F2] opacity-70 uppercase font-normal whitespace-nowrap px-3"
                >
                  {c.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeTable?.ok === false && (
              <tr>
                <td className="p-3 font-mono-data text-[11px] text-[#E15068]">
                  table not available yet (migration not run in this environment)
                </td>
              </tr>
            )}
            {activeTable?.latest.length === 0 && activeTable.ok && (
              <tr>
                <td className="p-3 font-mono-data text-[11px] text-[#E9E4F2] opacity-50">no rows yet</td>
              </tr>
            )}
            {activeTable?.latest.map((row, i) => (
              <tr key={i} className="border-b border-[rgba(233,228,242,0.05)] hover:bg-[rgba(233,228,242,0.03)]">
                {columns.map((c) => (
                  <td key={c} className="p-2 font-mono-data text-[11px] text-[#E9E4F2] whitespace-nowrap px-3">
                    {formatCell(row[c])}
                  </td>
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