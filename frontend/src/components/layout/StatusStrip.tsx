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
        backgroundColor: "#1F1B16",
        borderColor: "rgba(176,141,87,0.3)",
        flexShrink: 0,
      }}
    >
      {/* Case number */}
      <span
        className="font-stamp text-xs tracking-widest"
        style={{ color: "#B08D57", letterSpacing: "0.18em" }}
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

      {/* Live indicator */}
      <span
        className="font-mono-data text-[10px] tracking-widest"
        style={{ color: connected ? "#4A8C6A" : "#8A7A62" }}
      >
        ● LIVE
      </span>

      <div className="ml-auto flex items-center gap-3">
        {/* Narrate mode toggle */}
        <button
          onClick={onToggleNarrate}
          className="font-display text-[9px] tracking-widest uppercase px-2 py-0.5 border rounded transition-colors"
          style={{
            color: narrateMode ? "#1F1B16" : "rgba(176,141,87,0.5)",
            borderColor: narrateMode ? "#B08D57" : "rgba(176,141,87,0.2)",
            backgroundColor: narrateMode ? "#B08D57" : "transparent",
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
        backgroundColor: "rgba(176,141,87,0.25)",
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
        style={{ color: "rgba(176,141,87,0.6)" }}
      >
        {label}
      </span>
      <span
        className="font-mono-data text-xs"
        style={{ color: highlight ? "#4A8C6A" : "#B23A2F" }}
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
  const color = latest >= 90 ? "#4A8C6A" : "#B23A2F";

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
