export interface DocketEntry {
  id: string;
  timestamp: string;
  agent: string;
  tool: string;
  outcome: "pass" | "fail" | "pending";
}

interface Props {
  entries?: DocketEntry[];
  onSelect?: (id: string) => void;
  selectedId?: string;
}

export function Docket({ entries = [], onSelect, selectedId }: Props) {
  return (
    <aside
      className="flex flex-col border-l overflow-hidden"
      style={{
        width: 240,
        borderColor: "rgba(31,27,22,0.12)",
        backgroundColor: "rgba(237,230,214,0.4)",
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b flex items-center gap-2"
        style={{ borderColor: "rgba(31,27,22,0.12)" }}
      >
        <span
          className="font-stamp text-[10px] tracking-widest uppercase"
          style={{ color: "#B08D57", letterSpacing: "0.2em" }}
        >
          Docket
        </span>
        <span
          className="ml-auto font-mono-data"
          style={{ fontSize: 9, color: "rgba(31,27,22,0.35)" }}
        >
          {entries.length} entries
        </span>
      </div>

      {/* Column headers */}
      <div
        className="px-3 py-1 flex items-center gap-2 border-b"
        style={{
          borderColor: "rgba(31,27,22,0.08)",
          backgroundColor: "rgba(31,27,22,0.04)",
        }}
      >
        {["TIME", "AGENT", "TOOL", ""].map((h) => (
          <span
            key={h}
            className="font-display text-[8px] tracking-widest uppercase flex-1"
            style={{ color: "rgba(31,27,22,0.3)" }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto scrollbar-paper">
        {entries.length === 0 ? (
          <div className="p-4 text-center">
            <p
              className="font-stamp text-xs"
              style={{ color: "rgba(31,27,22,0.25)", letterSpacing: "0.1em" }}
            >
              NO ENTRIES
            </p>
            <p
              className="font-mono-data mt-1"
              style={{ fontSize: 9, color: "rgba(31,27,22,0.2)" }}
            >
              Awaiting first request…
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <DocketRow
              key={entry.id}
              entry={entry}
              isSelected={entry.id === selectedId}
              onClick={() => onSelect?.(entry.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function DocketRow({
  entry,
  isSelected,
  onClick,
}: {
  entry: DocketEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  const outcomeColor = {
    pass: "#2F4A3B",
    fail: "#B23A2F",
    pending: "#B08D57",
  }[entry.outcome];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-0 py-1.5 border-b text-left transition-colors hover:bg-black/5"
      style={{
        borderColor: "rgba(31,27,22,0.07)",
        backgroundColor: isSelected ? "rgba(176,141,87,0.1)" : "transparent",
        paddingLeft: 0,
      }}
    >
      {/* Outcome tab on left edge */}
      <div
        style={{
          width: 3,
          height: 28,
          backgroundColor: outcomeColor,
          flexShrink: 0,
          opacity: 0.8,
        }}
      />

      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-1">
          <span className="font-mono-data" style={{ fontSize: 9, color: "rgba(31,27,22,0.45)" }}>
            {entry.timestamp}
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span
            className="font-mono-data truncate"
            style={{ fontSize: 9, color: "#1F1B16", fontWeight: 500 }}
          >
            {entry.agent}
          </span>
          <span className="font-mono-data truncate" style={{ fontSize: 8, color: "rgba(31,27,22,0.4)" }}>
            /{entry.tool}
          </span>
        </div>
      </div>

      {/* Pass/fail dot */}
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: outcomeColor,
          flexShrink: 0,
          marginRight: 8,
          opacity: 0.7,
        }}
      />
    </button>
  );
}
