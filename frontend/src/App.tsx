import { useState, useEffect } from "react";
import { Sidebar, type SidebarTab } from "./components/layout/Sidebar";
import { StatusStrip } from "./components/layout/StatusStrip";
import { Docket } from "./components/layout/Docket";
import { BoardView } from "./views/BoardView";
import { ExhibitsView } from "./views/ExhibitsView";
import { WireView } from "./views/WireView";
import { AuditorView } from "./views/AuditorView";
import { IntakeView } from "./views/IntakeView";
import { InspectorDrawer } from "./components/inspector/InspectorDrawer";
import { useRequestStream } from "./lib/useRequestStream";
import { useInspector } from "./lib/useInspector";

export default function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("board");
  const [inspectorRequestId, setInspectorRequestId] = useState<string | null>(null);
  const [narrateMode, setNarrateMode] = useState(false);
  const [calmPeriodOver, setCalmPeriodOver] = useState(false);

  const { connected, reconnecting, boardState, docketEntries, wireLines, stats, agentVitals } = useRequestStream();
  const { data: inspectorData, loading: inspectorLoading, error: inspectorError } = useInspector(
    inspectorRequestId
  );

  useEffect(() => {
    // 10s calm period before highlighting Exhibits
    const t = setTimeout(() => setCalmPeriodOver(true), 10000);
    return () => clearTimeout(t);
  }, []);

  function openInspector(requestId: string) {
    setInspectorRequestId(requestId);
  }

  function closeInspector() {
    setInspectorRequestId(null);
  }

  return (
    <div
      className={narrateMode ? "narrate-mode" : ""}
      style={{
        display: "grid",
        gridTemplateColumns: "52px 1fr 240px",
        gridTemplateRows: "36px 1fr",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#EDE6D6",
      }}
    >
      <StatusStrip
        agentsOnline={stats.agentsOnline}
        requestsPerMin={stats.requestsPerMin}
        verifiedPct={stats.verifiedPct}
        history={stats.history}
        connected={connected && !reconnecting}
        narrateMode={narrateMode}
        onToggleNarrate={() => setNarrateMode((prev) => !prev)}
      />

      <Sidebar 
        active={activeTab} 
        onChange={setActiveTab} 
        highlightExhibits={calmPeriodOver && activeTab !== "exhibits"}
      />

      <main style={{ overflow: "hidden", display: "flex", flexDirection: "column", gridColumn: 2, gridRow: 2 }}>
        {activeTab === "board" && (
          <BoardView boardState={boardState} agentVitals={agentVitals} onInspectRequest={openInspector} />
        )}
        {activeTab === "exhibits" && <ExhibitsView />}
        {activeTab === "wire" && (
          <WireView lines={wireLines} onLineClick={openInspector} />
        )}
        {activeTab === "auditor" && <AuditorView />}
        {activeTab === "intake" && <IntakeView />}
      </main>

      <Docket
        entries={docketEntries}
        selectedId={inspectorRequestId ?? undefined}
        onSelect={openInspector}
      />

      <InspectorDrawer
        open={inspectorRequestId !== null}
        onClose={closeInspector}
        requestId={inspectorRequestId ?? undefined}
        loading={inspectorLoading}
        error={inspectorError}
        snapshot={inspectorData}
      />
    </div>
  );
}
