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

const BADGE_STYLES: Record<AttackOutcome["status"], { bg: string; fg: string; border: string; label: string }> = {
  not_run: { bg: "rgba(31,27,22,0.04)", fg: "rgba(31,27,22,0.45)", border: "rgba(31,27,22,0.25)", label: "NOT RUN" },
  blocked: { bg: "rgba(178,58,47,0.1)", fg: "#B23A2F", border: "#B23A2F", label: "BLOCKED" },
  passed: { bg: "rgba(178,58,47,0.1)", fg: "#B23A2F", border: "#B23A2F", label: "EXECUTED — VULNERABLE" },
};

export function Scoreboard() {
  const [outcomes, setOutcomes] = useState<Record<string, AttackOutcome>>({});

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchAttackResults().then((o) => !cancelled && setOutcomes(o));
    };
    load();
    const interval = setInterval(load, 5000); // pick up runs completed from the Exhibits tab
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="bg-[#E6DCC8] border border-[rgba(31,27,22,0.15)] rounded-sm p-5">
      <h3 className="font-stamp text-lg mb-4 text-[#1F1B16] uppercase tracking-widest border-b border-[rgba(31,27,22,0.1)] pb-2">
        Red Team Attack Outcomes
      </h3>
      <p className="font-mono-data text-[10px] opacity-50 mb-3" style={{ color: "#1F1B16" }}>
        Reflects exhibits you've actually run this session — visit Exhibits to run one.
      </p>
      <div className="flex flex-col gap-2">
        {ATTACKS.map((a, i) => {
          const outcome = outcomes[a.id] ?? { status: "not_run" as const, lastRunAt: null, lastReason: null };
          const style = BADGE_STYLES[outcome.status];
          return (
            <div
              key={a.id}
              className="flex justify-between items-center py-2 px-3 bg-[rgba(31,27,22,0.03)] border-l-2"
              style={{ borderLeftColor: outcome.status === "not_run" ? "rgba(31,27,22,0.2)" : "#1F1B16" }}
              title={outcome.lastReason ?? undefined}
            >
              <span className="font-mono-data text-xs uppercase" style={{ color: "#1F1B16" }}>
                [{String(i + 1).padStart(2, "0")}] {a.name}
              </span>
              <span
                className="font-stamp text-xs px-2 py-1 rounded-sm border"
                style={{ backgroundColor: style.bg, color: style.fg, borderColor: style.border }}
              >
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
