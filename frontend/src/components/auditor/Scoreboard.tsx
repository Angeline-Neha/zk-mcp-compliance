export function Scoreboard() {
  const attacks = [
    { name: "Replay", result: "BLOCKED" },
    { name: "Confused Deputy", result: "BLOCKED" },
    { name: "Privilege Escalation", result: "BLOCKED" },
    { name: "Lateral Movement", result: "BLOCKED" },
    { name: "Cross-Server Reuse", result: "BLOCKED" },
    { name: "Revocation Race (TOCTOU)", result: "BLOCKED" },
    { name: "Fake Compliance Proof", result: "BLOCKED" },
    { name: "Prompt Injection", result: "EXECUTED / BLOCKED", isSpecial: true },
    { name: "Salami Slicing", result: "BLOCKED" },
  ];

  return (
    <div className="bg-[#E6DCC8] border border-[rgba(31,27,22,0.15)] rounded-sm p-5">
      <h3 className="font-stamp text-lg mb-4 text-[#1F1B16] uppercase tracking-widest border-b border-[rgba(31,27,22,0.1)] pb-2">
        Red Team Attack Outcomes
      </h3>
      <div className="flex flex-col gap-2">
        {attacks.map((a, i) => (
          <div key={i} className="flex justify-between items-center py-2 px-3 bg-[rgba(31,27,22,0.03)] border-l-2" style={{ borderLeftColor: a.isSpecial ? "#B08D57" : "#1F1B16" }}>
            <span className="font-mono-data text-xs uppercase" style={{ color: "#1F1B16" }}>
              [{String(i + 1).padStart(2, "0")}] {a.name}
            </span>
            <span className="font-stamp text-xs px-2 py-1 bg-[rgba(178,58,47,0.1)] text-[#B23A2F] border border-[#B23A2F] rounded-sm">
              {a.result}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
