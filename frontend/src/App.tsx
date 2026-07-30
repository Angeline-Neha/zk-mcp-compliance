import { useState } from "react";
import { Sidebar, type SidebarTab } from "./components/layout/Sidebar";
import { StatusStrip } from "./components/layout/StatusStrip";
import { Docket } from "./components/layout/Docket";
import { BoardView } from "./views/BoardView";
import { ExhibitsView } from "./views/ExhibitsView";
import { WireView } from "./views/WireView";
import { AuditorView } from "./views/AuditorView";
import { IntakeView } from "./views/IntakeView";
import { useRequestStream } from "./lib/useRequestStream";

export default function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("board");
  const [selectedDocketId, setSelectedDocketId] = useState<string | undefined>();

  /* ── Live SSE stream ── */
  const { connected, boardState, docketEntries, wireLines, stats } = useRequestStream();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "52px 1fr 240px",
        gridTemplateRows: "36px 1fr",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#EDE6D6",
      }}
    >
      {/* Row 1: Status strip */}
      <StatusStrip
        agentsOnline={stats.agentsOnline}
        requestsPerMin={stats.requestsPerMin}
        verifiedPct={stats.verifiedPct}
        connected={connected}
      />

      {/* Row 2 col 1: Sidebar */}
      <Sidebar active={activeTab} onChange={setActiveTab} />

      {/* Row 2 col 2: Main canvas */}
      <main style={{ overflow: "hidden", display: "flex", flexDirection: "column", gridColumn: 2, gridRow: 2 }}>
        {activeTab === "board"    && <BoardView boardState={boardState} />}
        {activeTab === "exhibits" && <ExhibitsView />}
        {activeTab === "wire"     && <WireView lines={wireLines} />}
        {activeTab === "auditor"  && <AuditorView />}
        {activeTab === "intake"   && <IntakeView />}
      </main>

      {/* Row 2 col 3: Docket */}
      <Docket
        entries={docketEntries}
        selectedId={selectedDocketId}
        onSelect={setSelectedDocketId}
      />
    </div>
  );
}