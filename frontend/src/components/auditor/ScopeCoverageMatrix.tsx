export function ScopeCoverageMatrix() {
  const agents = ["Support Agent", "Admin Agent", "Confused Deputy"];
  const tools = ["issue_refund", "read_ledger", "delete_account"];
  
  const coverage: Record<string, Record<string, boolean>> = {
    "Support Agent": { "issue_refund": true, "read_ledger": true, "delete_account": false },
    "Admin Agent": { "issue_refund": true, "read_ledger": true, "delete_account": true },
    "Confused Deputy": { "issue_refund": true, "read_ledger": false, "delete_account": false },
  };

  return (
    <div className="bg-[#E6DCC8] border border-[rgba(31,27,22,0.15)] rounded-sm p-5 h-full">
      <h3 className="font-stamp text-lg mb-4 text-[#1F1B16] uppercase tracking-widest border-b border-[rgba(31,27,22,0.1)] pb-2">
        Scope Coverage Matrix
      </h3>
      
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="p-2 border-b border-[rgba(31,27,22,0.2)] font-mono-data text-[10px] text-[#1F1B16] opacity-70 uppercase font-normal">Agent</th>
              {tools.map(t => (
                <th key={t} className="p-2 border-b border-[rgba(31,27,22,0.2)] font-mono-data text-[10px] text-[#1F1B16] opacity-70 uppercase font-normal text-center whitespace-nowrap px-3">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => (
              <tr key={agent} className="border-b border-[rgba(31,27,22,0.05)] hover:bg-[rgba(31,27,22,0.03)]">
                <td className="p-2 font-stamp text-xs text-[#1F1B16] whitespace-nowrap">{agent}</td>
                {tools.map(tool => {
                  const hasAccess = coverage[agent]?.[tool];
                  return (
                    <td key={tool} className="p-2 text-center">
                      {hasAccess ? (
                        <span className="inline-block w-3 h-3 bg-[#2F4A3B] rounded-sm"></span>
                      ) : (
                        <span className="inline-block w-3 h-3 border border-[rgba(31,27,22,0.2)] rounded-sm"></span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex items-center gap-4 text-xs font-mono-data text-[9px] opacity-70 uppercase">
        <div className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-[#2F4A3B] rounded-sm"></span> Issued Scope</div>
        <div className="flex items-center gap-1"><span className="inline-block w-2 h-2 border border-[rgba(31,27,22,0.2)] rounded-sm"></span> No Attestation</div>
      </div>
    </div>
  );
}
