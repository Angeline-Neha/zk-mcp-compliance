import { useEffect, useRef, useState } from "react";

export interface ProofPanelData {
  status: "idle" | "pending" | "pass" | "fail";
  title: string;
  fields: { label: string; value: string }[];
  reason?: string;
}

function ProofPanel({ data }: { data: ProofPanelData }) {
  return (
    <div
      className={`panel p-4 flex-1 min-w-0 transition-colors duration-300 ${
        data.status === "pass"
          ? "border-pass/40"
          : data.status === "fail"
            ? "border-fail/40"
            : "border-slate-line"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-slate-400 font-display font-medium">
          {data.title}
        </span>
        <StatusBadge status={data.status} />
      </div>

      <Trace status={data.status} />

      <div className="mt-3 space-y-1.5">
        {data.fields.map((f) => (
          <div key={f.label} className="flex items-baseline gap-2 text-xs">
            <span className="text-slate-500 w-28 shrink-0 font-display">{f.label}</span>
            <span className="font-mono-data text-data/90 truncate" title={f.value}>
              {f.value}
            </span>
          </div>
        ))}
      </div>

      {data.status === "fail" && data.reason && (
        <div className="mt-3 pt-3 border-t border-fail/20">
          <span className="text-[10px] uppercase tracking-wide text-fail/70 font-display">reason</span>
          <p className="text-sm text-fail font-mono-data mt-0.5">{data.reason}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ProofPanelData["status"] }) {
  const map = {
    idle: { label: "AWAITING", cls: "text-slate-500 border-slate-structure" },
    pending: { label: "VERIFYING", cls: "text-data border-data/40 animate-pulse" },
    pass: { label: "VALID", cls: "text-pass border-pass/50" },
    fail: { label: "REJECTED", cls: "text-fail border-fail/50" },
  }[status];
  return (
    <span className={`text-[10px] font-mono-data px-2 py-0.5 border rounded ${map.cls}`}>{map.label}</span>
  );
}

/**
 * The oscilloscope-style trace — this is the signature visual. Draws an SVG
 * path that arcs smoothly for a pass, or spikes then breaks/flatlines for a
 * fail, animated in on status change via stroke-dasharray reveal.
 */
function Trace({ status }: { status: ProofPanelData["status"] }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey((k) => k + 1); // force re-mount to restart the draw-in animation
  }, [status]);

  const passPath = "M0,20 L20,20 L28,20 Q34,4 40,20 T52,20 L64,20 Q70,8 76,20 T88,20 L110,20";
  const failPath = "M0,20 L20,20 L28,20 Q34,4 40,20 L48,20 L52,32 L56,20 L110,20";
  const idlePath = "M0,20 L110,20";

  const d = status === "pass" ? passPath : status === "fail" ? failPath : idlePath;
  const strokeColor =
    status === "pass" ? "#3DFFB0" : status === "fail" ? "#FF4757" : status === "pending" ? "#7FDBFF" : "#2A3540";

  return (
    <svg viewBox="0 0 110 40" className="w-full h-10" preserveAspectRatio="none">
      <line x1="0" y1="20" x2="110" y2="20" stroke="#1E2731" strokeWidth="1" />
      <path
        key={key}
        ref={pathRef}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        className={status === "pending" ? "animate-pulse" : ""}
        style={{
          strokeDasharray: 200,
          strokeDashoffset: 0,
          animation: status !== "idle" ? "trace-draw 0.6s ease-out" : undefined,
        }}
      />
    </svg>
  );
}

export interface DualProofStripProps {
  proof1: ProofPanelData;
  proof2: ProofPanelData;
}

export function DualProofStrip({ proof1, proof2 }: DualProofStripProps) {
  return (
    <div className="flex gap-3">
      <ProofPanel data={proof1} />
      <ProofPanel data={proof2} />
    </div>
  );
}