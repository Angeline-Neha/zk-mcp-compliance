import { useEffect, useState } from "react";
import { fetchVerificationFunnel, FunnelStage } from "../../lib/api";

const COLORS: Record<string, string> = {
  Executed: "#54C99A",
};

export function CheckpointFunnel() {
  const [stages, setStages] = useState<FunnelStage[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchVerificationFunnel()
        .then((s) => !cancelled && setStages(s))
        .catch(() => !cancelled && setError(true));
    };
    load();
    const interval = setInterval(load, 5000); // refresh while the dashboard is open
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="bg-[#1E1530] border border-[rgba(233,228,242,0.15)] rounded-sm p-5 h-full">
      <h3 className="font-stamp text-lg mb-4 text-[#E9E4F2] uppercase tracking-widest border-b border-[rgba(233,228,242,0.1)] pb-2">
        Verification Funnel
      </h3>

      {error && (
        <p className="font-mono-data text-xs opacity-60" style={{ color: "#E15068" }}>
          Couldn't reach the audit log — is issuer-service running?
        </p>
      )}

      {!error && stages && stages[0].count === 0 && (
        <p className="font-mono-data text-xs opacity-60 mt-4" style={{ color: "#E9E4F2" }}>
          No real gate traffic yet. This fills in once requests are sent through
          the Task Interface or an exhibit that hits the actual finance/admin
          gate (5, 7, 8, 9).
        </p>
      )}

      {!error && stages && stages[0].count > 0 && (
        <div className="flex flex-col gap-3 mt-6">
          {stages.map((s, i) => {
            const max = stages[0].count || 1;
            const widthPct = (s.count / max) * 100;
            const color = COLORS[s.name] ?? "#E9E4F2";
            const isGreen = !!COLORS[s.name];
            return (
              <div
                key={i}
                className="flex flex-col"
                style={{ animation: `rise-in 0.35s ease-out ${i * 0.12}s both` }}
              >
                <div className="flex justify-between items-end mb-1">
                  <span className="font-mono-data text-[10px] uppercase opacity-70" style={{ color: "#E9E4F2" }}>
                    {s.name}
                  </span>
                  <span className="font-stamp text-xs" style={{ color }}>
                    {s.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-4 bg-[rgba(233,228,242,0.05)] w-full rounded-sm overflow-hidden relative border border-[rgba(233,228,242,0.1)]">
                  <div
                    className="absolute top-0 left-0 h-full"
                    style={{
                      width: widthPct + "%",
                      backgroundColor: isGreen ? "rgba(84,201,154,0.25)" : "rgba(233,228,242,0.15)",
                      borderRight: "2px solid " + (isGreen ? "#54C99A" : "rgba(233,228,242,0.3)"),
                      transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
                      transitionDelay: `${i * 0.12}s`,
                      boxShadow: isGreen ? "0 0 10px rgba(84,201,154,0.25)" : "none",
                    }}
                  />
                </div>
                {i < stages.length - 1 && stages[i + 1] && (
                  <span
                    className="font-mono-data text-[8px] uppercase self-end mt-0.5"
                    style={{ color: "rgba(225,80,104,0.6)" }}
                  >
                    −{(100 - (stages[i + 1].count / (s.count || 1)) * 100).toFixed(1)}% drop-off
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
