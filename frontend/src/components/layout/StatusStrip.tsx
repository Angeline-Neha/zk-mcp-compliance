import { TelegraphLight } from "./TelegraphLight";

interface Props {
  agentsOnline?: number;
  requestsPerMin?: number;
  verifiedPct?: number;
  history?: number[];
  connected?: boolean;
  narrateMode?: boolean;
  onToggleNarrate?: () => void;
}

export function StatusStrip({
  agentsOnline = 0,
  requestsPerMin = 0,
  verifiedPct = 0,
  history = [],
  connected = false,
  narrateMode = false,
  onToggleNarrate,
}: Props) {
  const caseNumber = "ZK-MCP-0417";

  return (
    <header
      className="col-span-3 flex items-center px-4 gap-0 border-b"
      style={{
        height: 36,
        backgroundColor: "#170F26",
        borderColor: "rgba(217,169,74,0.3)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
        flexShrink: 0,
      }}
    >
      {/* Case number — stamp face, gold, per layout spec */}
      <span
        className="font-stamp text-xs tracking-widest"
        style={{ color: "#D9A94A", letterSpacing: "0.18em", textShadow: "0 0 12px rgba(217,169,74,0.35)" }}
      >
        CASE #{caseNumber}
      </span>

      <Divider />

      <StatItem label="AGENTS ONLINE" value={String(agentsOnline)} />
      <Divider />
      <StatItem label="REQUESTS/MIN" value={String(requestsPerMin)} />
      <Divider />
      <div className="flex items-center gap-2">
        <StatItem label="VERIFIED" value={`${verifiedPct}%`} highlight={verifiedPct >= 90} />
        {history.length > 0 && <Sparkline data={history} />}
      </div>
      <Divider />

      {/* Live indicator — pulse dot ring, not a static dot */}
      <span
        className="font-mono-data text-[10px] tracking-widest flex items-center gap-1.5"
        style={{ color: connected ? "#6EDBB0" : "#7C7099" }}
      >
        <span className={`live-pulse-dot ${connected ? "live-pulse-dot--verified" : "live-pulse-dot--muted"}`} />
        LIVE
      </span>

      <div className="ml-auto flex items-center gap-3">
        {/* Narrate mode toggle */}
        <button
          onClick={onToggleNarrate}
          className="font-display text-[9px] tracking-widest uppercase px-2 py-0.5 border rounded transition-colors"
          style={{
            color: narrateMode ? "#E9E4F2" : "rgba(217,169,74,0.5)",
            borderColor: narrateMode ? "#D9A94A" : "rgba(217,169,74,0.2)",
            backgroundColor: narrateMode ? "#D9A94A" : "transparent",
          }}
          title="Narrate mode — slows animation and auto-opens Inspector"
        >
          NARRATE
        </button>
        <TelegraphLight connected={connected} />
      </div>
    </header>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 14,
        backgroundColor: "rgba(217,169,74,0.25)",
        margin: "0 12px",
        flexShrink: 0,
      }}
    />
  );
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className="font-display text-[9px] tracking-widest uppercase"
        style={{ color: "rgba(217,169,74,0.6)" }}
      >
        {label}
      </span>
      <span
        className="font-mono-data text-xs"
        style={{ color: highlight ? "#6EDBB0" : "#E15068" }}
      >
        {value}
      </span>
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  // Map 0-100 to y=14 to y=0 (14px height)
  const pathD = data
    .map((val, i) => {
      const x = (i / Math.max(1, data.length - 1)) * 40; // 40px width
      const y = 14 - (val / 100) * 14;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const latest = data[data.length - 1];
  const color = latest >= 90 ? "#6EDBB0" : "#E15068";

  return (
    <svg width="40" height="14" viewBox="0 0 40 14" className="overflow-visible ml-1">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
      />
    </svg>
  );
}
