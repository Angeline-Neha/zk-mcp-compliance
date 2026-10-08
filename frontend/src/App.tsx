import { useState, useEffect } from "react";
import { Sidebar, type SidebarTab } from "./components/layout/Sidebar";
import { StatusStrip } from "./components/layout/StatusStrip";
import { Docket } from "./components/layout/Docket";
import { BoardView } from "./views/BoardView";
import { ExhibitsView } from "./views/ExhibitsView";
import { WireView } from "./views/WireView";
import { AuditorView } from "./views/AuditorView";
import { IntakeView } from "./views/IntakeView";
import { BaselineView } from "./views/BaselineView";
import { InspectorDrawer } from "./components/inspector/InspectorDrawer";
import { useRequestStream } from "./lib/useRequestStream";
import { useInspector } from "./lib/useInspector";

export default function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("board");
  const [inspectorRequestId, setInspectorRequestId] = useState<string | null>(null);
  const [visualizedRequestId, setVisualizedRequestId] = useState<string | null>(null);
  const [narrateMode, setNarrateMode] = useState(false);
  const [calmPeriodOver, setCalmPeriodOver] = useState(false);

  const { connected, reconnecting, boardState, docketEntries, wireLines, stats, agentVitals, getBoardSnapshot } = useRequestStream();

  // When pinned to a specific past request, show its own snapshot instead of
  // the live merged board. Falls back to live if the snapshot isn't found.
  const displayedBoardState = visualizedRequestId
    ? getBoardSnapshot(visualizedRequestId) ?? boardState
    : boardState;

  function visualizeRequest(requestId: string) {
    setVisualizedRequestId(requestId);
    setActiveTab("board");
  }

  function returnToLive() {
    setVisualizedRequestId(null);
  }
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
      className={`zk-shell${narrateMode ? " narrate-mode" : ""}`}
      style={{
        display: "grid",
        gridTemplateColumns: "78px 1fr 264px",
        gridTemplateRows: "48px 1fr",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <StatusStrip
        agentsOnline={Math.min(stats.agentsOnline, 5)}
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

      <main className="zk-main">
        {activeTab === "board" && (
          <BoardView
            boardState={displayedBoardState}
            agentVitals={agentVitals}
            onInspectRequest={openInspector}
            viewingSnapshot={visualizedRequestId !== null}
            onReturnToLive={returnToLive}
          />
        )}
        {activeTab === "exhibits" && <ExhibitsView />}
        {activeTab === "wire" && (
          <WireView lines={wireLines} onLineClick={openInspector} />
        )}
        {activeTab === "auditor" && <AuditorView />}
        {activeTab === "intake" && <IntakeView />}
        {activeTab === "baseline" && <BaselineView />}
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
        onVisualize={inspectorRequestId ? () => visualizeRequest(inspectorRequestId) : undefined}
      />
    </div>
  );
}