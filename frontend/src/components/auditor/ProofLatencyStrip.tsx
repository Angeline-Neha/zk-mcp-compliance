import { useState, useRef, useEffect } from "react";

/* Proportions: Sigma ~1ms vs Groth16 ~210ms. On-screen race duration is
   compressed for legibility but keeps a wide gap between the two runners. */
const SIGMA_MS = 1;
const GROTH16_MS = 210;
const SIGMA_RACE_MS = 320;
const GROTH16_RACE_MS = 1650;

export function ProofLatencyStrip() {
  const [runId, setRunId] = useState(0);

  return (
    <div className="zk-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h3 className="zk-card-title">Proof latency</h3>
          <p className="zk-card-sub">Sigma protocol versus Groth16 zk-SNARK, same finish line.</p>
        </div>
        <button type="button" className="zk-btn-ghost" onClick={() => setRunId((n) => n + 1)}>
          Replay race
        </button>
      </div>

      <div style={{ paddingTop: 4 }}>
        <RaceLane key={`sigma-${runId}`} label="Proof 1: Sigma protocol" time={`${SIGMA_MS} ms`} color="#5E2750" durationMs={SIGMA_RACE_MS} />
        <RaceLane key={`groth-${runId}`} label="Proof 2: Groth16 zk-SNARK" time={`${GROTH16_MS} ms`} color="#53662D" durationMs={GROTH16_RACE_MS} isLast />

        <div style={{ marginTop: 16, padding: "8px 12px", background: "#F8E6E2", borderLeft: "3px solid #A8362C", borderRadius: "0 6px 6px 0", fontSize: 13 }}>
          Proof 2 is about 200x slower, which is why intent binding must run before it.
        </div>
      </div>
    </div>
  );
}

function RaceLane({
  label,
  time,
  color,
  durationMs,
  isLast,
}: {
  label: string;
  time: string;
  color: string;
  durationMs: number;
  isLast?: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true));
    const t = window.setTimeout(() => setFinished(true), durationMs + 40);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [durationMs]);

  return (
    <div style={{ marginBottom: isLast ? 0 : 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color }}>{label}</span>
        <span style={{ font: "500 13px var(--zk-mono)", color, opacity: finished ? 1 : 0.3, transition: "opacity 0.3s" }}>{time}</span>
      </div>

      <div
        ref={trackRef}
        style={{
          position: "relative",
          height: 26,
          borderRadius: 6,
          border: `1px solid ${finished ? color : "rgba(10,51,35,0.16)"}`,
          overflow: "hidden",
          background: "repeating-linear-gradient(90deg, rgba(10,51,35,0.02) 0 24px, rgba(10,51,35,0.06) 24px 25px)",
          transition: "border-color 0.3s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 10,
            width: 2,
            background: "repeating-linear-gradient(180deg, #0A3323 0 3px, transparent 3px 6px)",
            opacity: 0.45,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            width: 14,
            height: 14,
            marginTop: -7,
            borderRadius: "50%",
            background: color,
            left: started ? "calc(100% - 22px)" : 2,
            transition: `left ${durationMs}ms cubic-bezier(0.3,0,0.2,1)`,
          }}
        />
        {finished && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: 14,
              marginTop: -9,
              fontWeight: 700,
              color,
              animation: "stamp-land-overshoot 0.4s cubic-bezier(.2,1.6,.4,1) forwards",
            }}
          >
            &#10003;
          </div>
        )}
      </div>
    </div>
  );
}
