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
  not_run: { bg: "rgba(233,228,242,0.04)", fg: "rgba(233,228,242,0.45)", border: "rgba(233,228,242,0.25)", label: "NOT RUN" },
  blocked: { bg: "rgba(84,201,154,0.1)", fg: "#54C99A", border: "#54C99A", label: "BLOCKED — DEFENDED" },
  passed: { bg: "rgba(225,80,104,0.12)", fg: "#E15068", border: "#E15068", label: "EXECUTED — VULNERABLE" },
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
    <div className="bg-[#1E1530] border border-[rgba(233,228,242,0.15)] rounded-sm p-5">
      <h3 className="font-stamp text-lg mb-4 text-[#E9E4F2] uppercase tracking-widest border-b border-[rgba(233,228,242,0.1)] pb-2">
        Red Team Attack Outcomes
      </h3>
      <p className="font-mono-data text-[10px] opacity-50 mb-3" style={{ color: "#E9E4F2" }}>
        Reflects attacks you've actually run this session — via Exhibits or the Intake Desk red-team agent.
      </p>
      <div className="flex flex-col gap-2">
        {ATTACKS.map((a, i) => {
          const outcome = outcomes[a.id] ?? { status: "not_run" as const, lastRunAt: null, lastReason: null };
          const style = BADGE_STYLES[outcome.status];
          return (
            <div
              key={a.id}
              className="flex justify-between items-center py-2 px-3 bg-[rgba(233,228,242,0.03)] border-l-2 transition-colors"
              style={{
                borderLeftColor: outcome.status === "not_run" ? "rgba(233,228,242,0.2)" : style.fg,
                animation: `rise-in 0.3s ease-out ${i * 0.05}s both`,
              }}
              title={outcome.lastReason ?? undefined}
            >
              <span className="font-mono-data text-xs uppercase" style={{ color: "#E9E4F2" }}>
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
