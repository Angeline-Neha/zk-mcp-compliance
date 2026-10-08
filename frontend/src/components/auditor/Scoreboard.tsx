import { useEffect, useState } from "react";
import { fetchAttackResults, AttackOutcome } from "../../lib/api";

const ATTACKS: { id: string; name: string }[] = [
  { id: "1", name: "Replay" },
  { id: "2", name: "Confused Deputy" },
  { id: "3", name: "Privilege Escalation" },
  { id: "4", name: "Lateral Movement" },
  { id: "5", name: "Cross-Server Reuse" },
  { id: "6", name: "Revocation Race (TOCTOU)" },
  { id: "7", name: "Fake Compliance Proof" },
  { id: "8", name: "Prompt Injection" },
  { id: "9", name: "Salami Slicing" },
];

const BADGE_STYLES: Record<AttackOutcome["status"], { bg: string; fg: string; bar: string; label: string }> = {
  not_run: { bg: "rgba(10,51,35,0.07)", fg: "rgba(10,51,35,0.6)", bar: "rgba(10,51,35,0.2)", label: "Not run" },
  blocked: { bg: "rgba(131,153,88,0.22)", fg: "#53662D", bar: "#839958", label: "Blocked, defended" },
  passed:  { bg: "rgba(168,54,44,0.12)", fg: "#A8362C", bar: "#A8362C", label: "Executed, vulnerable" },
};

export function Scoreboard() {
  const [outcomes, setOutcomes] = useState<Record<string, AttackOutcome>>({});

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchAttackResults().then((o) => !cancelled && setOutcomes(o)).catch(() => {});
    };
    load();
    const interval = setInterval(load, 5000); // pick up runs completed from the Exhibits tab
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="zk-card" style={{ height: "100%" }}>
      <h3 className="zk-card-title">Red team attack outcomes</h3>
      <p className="zk-card-sub">Attacks you have run this session, via Exhibits or the Intake red-team agent.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ATTACKS.map((a, i) => {
          const outcome = outcomes[a.id] ?? { status: "not_run" as const, lastRunAt: null, lastReason: null };
          const s = BADGE_STYLES[outcome.status];
          return (
            <div
              key={a.id}
              title={outcome.lastReason ?? undefined}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                background: "var(--zk-paper)",
                borderLeft: `3px solid ${s.bar}`,
                borderRadius: "0 6px 6px 0",
                animation: `rise-in 0.3s ease-out ${i * 0.04}s both`,
              }}
            >
              <span style={{ font: "500 12.5px var(--zk-mono)" }}>
                {String(i + 1).padStart(2, "0")} · {a.name}
              </span>
              <span style={{ font: "600 11.5px var(--zk-sans)", padding: "2px 10px", borderRadius: 99, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
