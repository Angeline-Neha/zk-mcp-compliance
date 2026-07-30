import { TelegraphLight } from "./TelegraphLight";

interface Props {
  agentsOnline?: number;
  requestsPerMin?: number;
  verifiedPct?: number;
  connected?: boolean;
}

export function StatusStrip({
  agentsOnline = 0,
  requestsPerMin = 0,
  verifiedPct = 0,
  connected = false,
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
      <StatItem label="VERIFIED" value={`${verifiedPct}%`} highlight={verifiedPct >= 90} />
      <Divider />

      {/* Live indicator */}
      <span
        className="font-mono-data text-[10px] tracking-widest"
        style={{ color: connected ? "#4A8C6A" : "#8A7A62" }}
      >
        ● LIVE
      </span>

      <div className="ml-auto flex items-center gap-3">
        {/* Narrate mode toggle — off by default */}
        <NarrateToggle />
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
        style={{ color: highlight ? "#4A8C6A" : "#B08D57" }}
      >
        {value}
      </span>
    </span>
  );
}

function NarrateToggle() {
  return (
    <button
      className="font-display text-[9px] tracking-widest uppercase px-2 py-0.5 border rounded transition-colors"
      style={{
        color: "rgba(176,141,87,0.5)",
        borderColor: "rgba(176,141,87,0.2)",
        backgroundColor: "transparent",
      }}
      title="Narrate mode — slows animation and auto-opens Inspector"
    >
      NARRATE
    </button>
  );
}
