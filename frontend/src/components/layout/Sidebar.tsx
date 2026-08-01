export type SidebarTab = "board" | "exhibits" | "wire" | "auditor" | "intake";

const TABS: { id: SidebarTab; label: string; abbr: string }[] = [
  { id: "board",    label: "THE BOARD",  abbr: "B" },
  { id: "exhibits", label: "EXHIBITS",   abbr: "E" },
  { id: "wire",     label: "THE WIRE",   abbr: "W" },
  { id: "auditor",  label: "AUDITOR",    abbr: "A" },
  { id: "intake",   label: "INTAKE",     abbr: "I" },
];

interface Props {
  active: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  highlightExhibits?: boolean;
}

export function Sidebar({ active, onChange, highlightExhibits = false }: Props) {
  return (
    <aside
      className="flex flex-col items-center py-3 gap-1 border-r ink-rule"
      style={{ backgroundColor: "rgba(237,230,214,0.5)", borderColor: "rgba(31,27,22,0.12)", width: 52 }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const isHighlight = tab.id === "exhibits" && highlightExhibits;
        return (
          <button
            key={tab.id}
            title={tab.label}
            onClick={() => onChange(tab.id)}
            className="relative group"
            style={{ width: 40 }}
          >
            {/* The folder tab */}
            <div
              className={`flex items-center justify-center transition-all duration-200 ${isActive ? "folder-tab-active" : ""} ${isHighlight ? "animate-pulse" : ""}`}
              style={{
                height: 44,
                width: 40,
                backgroundColor: isActive ? "#EDE6D6" : isHighlight ? "rgba(178, 58, 47, 0.1)" : "rgba(237,230,214,0.35)",
                border: "1.5px solid rgba(31,27,22,0.15)",
                borderRadius: "3px 3px 0 0",
                borderBottom: isActive ? "1.5px solid #EDE6D6" : "1.5px solid rgba(31,27,22,0.15)",
              }}
            >
              <span
                className="font-stamp text-center leading-none"
                style={{
                  fontSize: 10,
                  color: isActive ? "#1F1B16" : isHighlight ? "#B23A2F" : "rgba(31,27,22,0.45)",
                  writingMode: "vertical-lr",
                  textOrientation: "mixed",
                  transform: "rotate(180deg)",
                  letterSpacing: "0.12em",
                }}
              >
                {tab.label}
              </span>
            </div>
            {/* Active indicator tab strip */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  left: -2,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                  height: 24,
                  backgroundColor: "#B08D57",
                  borderRadius: "0 2px 2px 0",
                }}
              />
            )}
          </button>
        );
      })}

      {/* Bottom: case file icon */}
      <div className="mt-auto mb-1 opacity-30">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="4" width="14" height="13" rx="1" stroke="#1F1B16" strokeWidth="1.2"/>
          <path d="M7 4V2h6v2" stroke="#1F1B16" strokeWidth="1.2"/>
          <line x1="6" y1="9" x2="14" y2="9" stroke="#1F1B16" strokeWidth="1"/>
          <line x1="6" y1="12" x2="12" y2="12" stroke="#1F1B16" strokeWidth="1"/>
        </svg>
      </div>
    </aside>
  );
}
