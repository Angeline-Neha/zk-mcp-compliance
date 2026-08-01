export function ProofLatencyStrip() {
  return (
    <div className="bg-[#E6DCC8] border border-[rgba(31,27,22,0.15)] rounded-sm p-5">
      <h3 className="font-stamp text-lg mb-4 text-[#1F1B16] uppercase tracking-widest border-b border-[rgba(31,27,22,0.1)] pb-2 flex justify-between items-center">
        <span>Proof Latency (Photo-Finish)</span>
        <span className="font-mono-data text-[9px] opacity-50">Log Scale (ms)</span>
      </h3>

      <div className="relative pt-8 pb-4">
        {/* Track */}
        <div className="h-10 bg-[rgba(31,27,22,0.03)] border-y border-[rgba(31,27,22,0.1)] relative">

          {/* Start Line */}
          <div className="absolute top-0 bottom-0 left-0 w-px bg-[#1F1B16] opacity-30" />

          {/* Proof 1 bar (fast) */}
          <div
            className="absolute top-2 left-0 h-2 bg-[#B08D57] rounded-r-sm"
            style={{ width: "2%" }}
          />
          <div
            className="absolute font-mono-data text-[9px] uppercase tracking-wider"
            style={{ top: "-15px", left: "0%", color: "#B08D57" }}
          >
            Proof 1 (Sigma) ~1ms
          </div>

          {/* Proof 2 bar (slow) */}
          <div
            className="absolute top-6 left-0 h-2 bg-[#2F4A3B] rounded-r-sm"
            style={{ width: "85%" }}
          />
          <div
            className="absolute font-mono-data text-[9px] uppercase tracking-wider"
            style={{ top: "-15px", left: "85%", transform: "translateX(-100%)", color: "#2F4A3B" }}
          >
            Proof 2 (Groth16) ~210ms
          </div>
        </div>

        <div className="mt-4 text-center">
          <span className="font-stamp text-xs text-[#B23A2F] bg-[rgba(178,58,47,0.05)] px-3 py-1 border border-[rgba(178,58,47,0.2)] rounded-sm">
            Proof 2 is ~200x slower. This is why Intent Binding MUST run before it.
          </span>
        </div>
      </div>
    </div>
  );
}
