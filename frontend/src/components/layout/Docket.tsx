import { useState, useRef, useEffect } from "react";

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

const ROW_HEIGHT = 44; // Matches the height of DocketRow
const OVERSCAN = 10;

export function Docket({ entries = [], onSelect, selectedId }: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const totalHeight = entries.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    entries.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
  );

  const visibleEntries = entries.slice(startIndex, endIndex);

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
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-paper"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
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
          <div style={{ height: totalHeight, position: "relative" }}>
            {visibleEntries.map((entry, index) => {
              const actualIndex = startIndex + index;
              return (
                <div 
                  key={entry.id} 
                  style={{ 
                    position: "absolute", 
                    top: actualIndex * ROW_HEIGHT,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT 
                  }}
                >
                  <DocketRow
                    entry={entry}
                    isSelected={entry.id === selectedId}
                    onClick={() => onSelect?.(entry.id)}
                  />
                </div>
              );
            })}
          </div>
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
