export function CheckpointFunnel() {
  const stages = [
    { name: "Traffic Received", count: 1240, color: "#1F1B16" },
    { name: "Proof 1 (Sigma)", count: 1195, color: "#1F1B16" },
    { name: "Intent Binding", count: 1102, color: "#1F1B16" },
    { name: "Proof 2 (Groth16)", count: 980, color: "#1F1B16" },
    { name: "Executed", count: 980, color: "#2F4A3B" },
  ];

  const max = stages[0].count;

  return (
    <div className="bg-[#E6DCC8] border border-[rgba(31,27,22,0.15)] rounded-sm p-5 h-full">
      <h3 className="font-stamp text-lg mb-4 text-[#1F1B16] uppercase tracking-widest border-b border-[rgba(31,27,22,0.1)] pb-2">
        Verification Funnel
      </h3>

      <div className="flex flex-col gap-3 mt-6">
        {stages.map((s, i) => {
          const widthPct = (s.count / max) * 100;
          const isGreen = s.color === "#2F4A3B";
          return (
            <div key={i} className="flex flex-col">
              <div className="flex justify-between items-end mb-1">
                <span className="font-mono-data text-[10px] uppercase opacity-70" style={{ color: "#1F1B16" }}>
                  {s.name}
                </span>
                <span className="font-stamp text-xs" style={{ color: s.color }}>
                  {s.count.toLocaleString()}
                </span>
              </div>
              <div className="h-4 bg-[rgba(31,27,22,0.05)] w-full rounded-sm overflow-hidden relative border border-[rgba(31,27,22,0.1)]">
                <div
                  className="absolute top-0 left-0 h-full"
                  style={{
                    width: widthPct + "%",
                    backgroundColor: isGreen ? "rgba(47,74,59,0.25)" : "rgba(31,27,22,0.15)",
                    borderRight: "2px solid " + (isGreen ? "#2F4A3B" : "rgba(31,27,22,0.3)"),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
