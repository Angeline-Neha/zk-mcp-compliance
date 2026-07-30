import { useState } from "react";
import { StatusBar } from "./components/StatusBar";
import { LiveEventLog } from "./views/LiveEventLog";
import { TaskInterface } from "./views/TaskInterface";
import { AttackControlPanel } from "./views/AttackControlPanel";
import { AgentGraph } from "./views/AgentGraph";
import { AuditorComparison } from "./views/AuditorComparison";
import { resetDemo } from "./lib/api";

type ViewId = "log" | "task" | "attacks" | "graph" | "auditor";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "log", label: "Live Event Log" },
  { id: "task", label: "Task Interface" },
  { id: "attacks", label: "Attack Control Panel" },
  { id: "graph", label: "Agent Graph" },
  { id: "auditor", label: "Auditor Comparison" },
];

export default function App() {
  const [active, setActive] = useState<ViewId>("log");
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await resetDemo();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-ink">
      <StatusBar />

      <div className="border-b border-slate-line bg-ink-raised px-4 flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setActive(v.id)}
            className={`px-3 py-2.5 text-xs font-display font-medium uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
              active === v.id
                ? "border-pass text-pass"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {v.label}
          </button>
        ))}
        <button
          onClick={handleReset}
          disabled={resetting}
          className="ml-auto my-1.5 px-3 py-1 text-xs font-mono-data border border-slate-structure text-slate-400 rounded hover:border-fail/50 hover:text-fail disabled:opacity-40 transition-colors whitespace-nowrap"
          title="Restores seed orders/accounts to known-good state for a fresh demo run"
        >
          {resetting ? "resetting…" : "reset demo state"}
        </button>
      </div>

      <main className="flex-1 overflow-hidden">
        {active === "log" && <LiveEventLog />}
        {active === "task" && <TaskInterface />}
        {active === "attacks" && <AttackControlPanel />}
        {active === "graph" && <AgentGraph />}
        {active === "auditor" && <AuditorComparison />}
      </main>
    </div>
  );
}