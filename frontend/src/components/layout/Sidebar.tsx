import type { ReactNode } from "react";

export type SidebarTab = "board" | "exhibits" | "wire" | "auditor" | "intake" | "baseline";

const ICONS: Record<SidebarTab, ReactNode> = {
  board: (
    <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M7.5 12L16.5 6M7.5 12l9 6" /></svg>
  ),
  exhibits: (
    <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
  ),
  wire: (
    <svg viewBox="0 0 24 24"><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>
  ),
  auditor: (
    <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
  ),
  intake: (
    <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h6" /><path d="M17 14l3 3-3 3" /></svg>
  ),
  baseline: (
    <svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
  ),
};

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "board",    label: "The Board" },
  { id: "exhibits", label: "Exhibits" },
  { id: "wire",     label: "The Wire" },
  { id: "auditor",  label: "Auditor" },
  { id: "intake",   label: "Intake" },
  { id: "baseline", label: "Baseline" },
];

interface Props {
  active: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  highlightExhibits?: boolean;
}

export function Sidebar({ active, onChange, highlightExhibits = false }: Props) {
  return (
    <nav
      aria-label="Views"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 6px",
        backgroundColor: "#3F1735",
        gridColumn: 1,
        gridRow: 2,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const isHighlight = tab.id === "exhibits" && highlightExhibits;
        return (
          <button
            key={tab.id}
            title={tab.label}
            onClick={() => onChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={`zk-rail-btn${isHighlight ? " zk-rail-btn--hl" : ""}`}
          >
            {ICONS[tab.id]}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
