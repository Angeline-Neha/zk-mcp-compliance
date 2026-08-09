import { Scoreboard } from "../components/auditor/Scoreboard";
import { BreachComparison } from "../components/auditor/BreachComparison";
import { CheckpointFunnel } from "../components/auditor/CheckpointFunnel";
import { ProofLatencyStrip } from "../components/auditor/ProofLatencyStrip";
import { AuthorityTree } from "../components/auditor/AuthorityTree";
import { ScopeCoverageMatrix } from "../components/auditor/ScopeCoverageMatrix";
import { Oscilloscope } from "../components/auditor/Oscilloscope";

export function AuditorView() {
  return (
    <div className="auditor-layout h-full overflow-y-auto p-8" style={{ backgroundColor: "#0D0817" }}>
      
      <div className="flex items-end justify-between border-b-2 pb-4 mb-8" style={{ borderColor: "rgba(233,228,242,0.15)" }}>
        <div>
          <h1 className="font-stamp text-4xl m-0" style={{ color: "#E9E4F2" }}>AUDITOR DASHBOARD</h1>
          <p className="font-mono-data text-xs mt-2 opacity-60 m-0 uppercase tracking-widest">
            Cryptographic Integrity & Baseline Comparison
          </p>
        </div>
        <Oscilloscope />
      </div>

      <div className="grid grid-cols-12 gap-8 mb-8">
        <div className="col-span-8">
          <Scoreboard />
        </div>
        <div className="col-span-4">
          <CheckpointFunnel />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 mb-8">
        <div className="col-span-12">
          <ProofLatencyStrip />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 mb-8">
        <div className="col-span-12">
          <BreachComparison />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 pb-12">
        <div className="col-span-7">
          <AuthorityTree />
        </div>
        <div className="col-span-5">
          <ScopeCoverageMatrix />
        </div>
      </div>
    </div>
  );
}
