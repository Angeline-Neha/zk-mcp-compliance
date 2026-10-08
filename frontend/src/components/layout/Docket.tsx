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

const ROW_HEIGHT = 52; // Matches the height of DocketRow
const OVERSCAN = 10;

const OUTCOME_COLOR = {
  pass: "#839958",
  fail: "#E4604E",
  pending: "#D5B893",
} as const;

export function Docket({ entries = [], onSelect, selectedId }: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((obs) => {
      setContainerHeight(obs[0].contentRect.height);
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
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
        backgroundColor: "#0A3323",
        color: "#F7F4D5",
        fontFamily: "var(--zk-sans)",
        gridColumn: 3,
        gridRow: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "14px 16px 10px",
          borderBottom: "1px solid rgba(247,244,213,0.18)",
        }}
      >
        <b style={{ fontSize: 14 }}>Docket</b>
        <span style={{ font: "400 12px var(--zk-mono)", opacity: 0.6 }}>{entries.length} entries</span>
      </div>

      <div
        ref={containerRef}
        className="zk-docket-scroll"
        style={{ flex: 1, overflowY: "auto" }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        {entries.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, opacity: 0.7 }}>No entries</p>
            <p style={{ font: "400 12px var(--zk-mono)", margin: "4px 0 0", opacity: 0.45 }}>
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
                    height: ROW_HEIGHT,
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
  const color = OUTCOME_COLOR[entry.outcome];

  return (
    <button
      onClick={onClick}
      className="zk-docket-row"
      style={{
        display: "grid",
        gridTemplateColumns: "10px 1fr auto",
        gap: 10,
        alignItems: "center",
        width: "100%",
        height: ROW_HEIGHT,
        padding: "0 16px",
        textAlign: "left",
        color: "inherit",
        font: "inherit",
        cursor: "pointer",
        border: 0,
        borderBottom: "1px solid rgba(247,244,213,0.12)",
        backgroundColor: isSelected ? "rgba(211,150,140,0.16)" : "transparent",
        boxShadow: isSelected ? "inset 3px 0 0 #D3968C" : "none",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: color,
          animation: entry.outcome === "pending" ? "zk-blink 1s ease-in-out infinite" : "none",
        }}
      />
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            font: "500 13px var(--zk-mono)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {entry.tool}
        </span>
        <span style={{ fontSize: 11.5, opacity: 0.6 }}>{entry.agent}</span>
      </span>
      <span style={{ font: "400 11px var(--zk-mono)", opacity: 0.55 }}>{entry.timestamp}</span>
    </button>
  );
}
