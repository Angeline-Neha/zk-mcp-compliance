import { useState, useRef, useEffect } from "react";

/* Real proportions: Sigma ~1ms vs Groth16 ~210ms — on-screen race
   duration is compressed for legibility but keeps a wide gap between
   the two runners so the ~200x latency difference is felt, not just read. */
const SIGMA_MS = 1;
const GROTH16_MS = 210;
const SIGMA_RACE_MS = 320;
const GROTH16_RACE_MS = 1650;

export function ProofLatencyStrip() {
  const [runId, setRunId] = useState(0);

  function replay() {
    setRunId((n) => n + 1);
  }

  return (
    <div className="bg-[#1E1530] border border-[rgba(233,228,242,0.15)] rounded-sm p-5">
      <h3 className="font-stamp text-lg mb-4 text-[#E9E4F2] uppercase tracking-widest border-b border-[rgba(233,228,242,0.1)] pb-2 flex justify-between items-center">
        <span>Proof Latency — Photo Finish</span>
        <button
          type="button"
          onClick={replay}
          className="font-mono-data text-[9px] uppercase tracking-wider px-2 py-1 border rounded-sm transition-colors charge-sweep"
          style={{ color: "#D9A94A", borderColor: "rgba(217,169,74,0.4)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(217,169,74,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          &#9656; Replay Race
        </button>
      </h3>

      <div className="relative pt-2 pb-1">
        <RaceLane
          key={`sigma-${runId}`}
          label="Proof 1 — Sigma Protocol"
          time={`${SIGMA_MS}ms`}
          color="#D9A94A"
          durationMs={SIGMA_RACE_MS}
        />
        <RaceLane
          key={`groth-${runId}`}
          label="Proof 2 — Groth16 zk-SNARK"
          time={`${GROTH16_MS}ms`}
          color="#54C99A"
          durationMs={GROTH16_RACE_MS}
          isLast
        />

        <div className="mt-5 text-center">
          <span className="font-stamp text-xs text-[#E15068] bg-[rgba(225,80,104,0.05)] px-3 py-1 border border-[rgba(225,80,104,0.2)] rounded-sm inline-block">
            Proof 2 is ~200x slower. This is why Intent Binding MUST run before it.
          </span>
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
    <div className={isLast ? "" : "mb-6"}>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="font-mono-data text-[10px] uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <span
          className="font-stamp text-xs transition-opacity duration-300"
          style={{ color, opacity: finished ? 1 : 0.25 }}
        >
          {time}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-6 rounded-sm border overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(233,228,242,0.02) 0 24px, rgba(233,228,242,0.05) 24px 25px)",
          borderColor: finished ? color : "rgba(233,228,242,0.12)",
          transition: "border-color 0.3s",
        }}
      >
        {/* Finish line */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            right: 10,
            width: 2,
            background: "repeating-linear-gradient(180deg, #E9E4F2 0 3px, transparent 3px 6px)",
            opacity: 0.4,
          }}
        />

        {/* Runner */}
        <div
          className="absolute top-1/2 rounded-full"
          style={{
            width: 14,
            height: 14,
            marginTop: -7,
            background: color,
            boxShadow: finished ? `0 0 10px 2px ${color}` : `0 0 6px 1px ${color}88`,
            left: started ? "calc(100% - 22px)" : 2,
            transition: `left ${durationMs}ms cubic-bezier(0.3,0,0.2,1)`,
          }}
        />

        {/* Finished checkmark stamp */}
        {finished && (
          <div
            className="absolute top-1/2 font-stamp text-[10px] uppercase tracking-wider"
            style={{
              color,
              right: 14,
              marginTop: -6,
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
