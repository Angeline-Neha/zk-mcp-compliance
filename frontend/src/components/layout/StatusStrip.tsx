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
  return (
    <header
      className="col-span-3"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 26,
        padding: "0 18px",
        height: 48,
        backgroundColor: "#0A3323",
        color: "#F7F4D5",
        fontFamily: "var(--zk-sans)",
        overflowX: "auto",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 700 }}>
        ZK-MCP
        <span style={{ opacity: 0.55, fontWeight: 500, marginLeft: 6 }}>Auth &amp; Compliance</span>
      </span>

      <TelegraphLight connected={connected} />

      <StatItem label="services online" value={String(agentsOnline)} />
      <StatItem label="req / min" value={String(requestsPerMin)} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatItem label="verified" value={`${verifiedPct}%`} />
        {history.length > 0 && <Sparkline data={history} />}
      </div>

      <button
        onClick={onToggleNarrate}
        aria-pressed={narrateMode}
        title="Narrate mode — slows animation and auto-opens Inspector"
        style={{
          marginLeft: "auto",
          font: "500 12px var(--zk-sans)",
          color: narrateMode ? "#0A3323" : "#F7F4D5",
          background: narrateMode ? "#D3968C" : "transparent",
          border: `1px solid ${narrateMode ? "#D3968C" : "rgba(247,244,213,0.4)"}`,
          borderRadius: 6,
          padding: "5px 11px",
          cursor: "pointer",
        }}
      >
        Narrate
      </button>
    </header>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
      <b style={{ font: "500 15px var(--zk-mono)" }}>{value}</b>
      <span style={{ fontSize: 12, opacity: 0.65 }}>{label}</span>
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  // Map 0-100 to y=20 to y=2 (22px height)
  const pathD = data
    .map((val, i) => {
      const x = (i / Math.max(1, data.length - 1)) * 80;
      const y = 20 - (val / 100) * 18;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const latest = data[data.length - 1];
  const color = latest >= 90 ? "#A9C06F" : "#D3968C";

  return (
    <svg width="80" height="22" viewBox="0 0 80 22" style={{ overflow: "visible" }} aria-label="Verified rate history">
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
