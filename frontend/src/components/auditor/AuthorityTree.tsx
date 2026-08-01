export function AuthorityTree() {
  return (
    <div className="bg-[#E6DCC8] border border-[rgba(31,27,22,0.15)] rounded-sm p-5 h-full">
      <h3 className="font-stamp text-lg mb-6 text-[#1F1B16] uppercase tracking-widest border-b border-[rgba(31,27,22,0.1)] pb-2">
        Authority Delegation Tree
      </h3>
      
      <div className="flex flex-col items-center pt-2 pb-6">
        {/* Root Node */}
        <div className="border-2 border-[#1F1B16] px-4 py-2 bg-[#EDE6D6] z-10">
          <div className="font-stamp text-sm">Root Issuer</div>
          <div className="font-mono-data text-[10px] text-center opacity-70 mt-1">Unlimited</div>
        </div>

        {/* Thick line down */}
        <div className="w-1 h-6 bg-[#1F1B16]"></div>

        {/* Agent A */}
        <div className="border border-[#1F1B16] px-4 py-2 bg-[#EDE6D6] z-10 flex flex-col items-center min-w-[120px]">
          <div className="font-stamp text-xs">Agent A</div>
          <div className="font-mono-data text-[10px] text-center text-[#2F4A3B] mt-1">$100 Limit</div>
        </div>

        <div className="flex w-full justify-center relative mt-0">
          {/* Connecting lines */}
          <div className="absolute w-[180px] h-[1px] bg-[#1F1B16] top-[12px] opacity-50"></div>
          
          {/* Branch 1 */}
          <div className="flex flex-col items-center w-1/2 pt-[12px]">
            <div className="w-[1px] h-4 bg-[#1F1B16] opacity-50"></div>
            <div className="border border-[rgba(31,27,22,0.5)] px-3 py-1 bg-[#EDE6D6] z-10 flex flex-col items-center">
              <div className="font-stamp text-[10px]">Agent B</div>
              <div className="font-mono-data text-[9px] text-[#2F4A3B] mt-1">$50 Limit</div>
            </div>
            {/* Escalation Attempt (Broken line) */}
            <div className="w-[1px] h-6 border-l-2 border-dashed border-[#B23A2F] mt-1"></div>
            <div className="border border-[#B23A2F] bg-[rgba(178,58,47,0.05)] px-3 py-1 z-10 flex flex-col items-center relative">
              <div className="font-stamp text-[10px] text-[#B23A2F]">Agent C</div>
              <div className="font-mono-data text-[9px] text-[#B23A2F] mt-1">$50,000 Limit</div>
              <div className="absolute -right-24 top-2 font-stamp text-[8px] text-[#B23A2F] bg-[rgba(178,58,47,0.1)] px-1 rotate-3">
                ESCALATION DENIED
              </div>
            </div>
          </div>

          {/* Branch 2 */}
          <div className="flex flex-col items-center w-1/2 pt-[12px]">
            <div className="w-[1px] h-4 bg-[#1F1B16] opacity-50"></div>
            <div className="border border-[rgba(31,27,22,0.5)] px-3 py-1 bg-[#EDE6D6] z-10 flex flex-col items-center">
              <div className="font-stamp text-[10px]">Agent D</div>
              <div className="font-mono-data text-[9px] text-[#2F4A3B] mt-1">$30 Limit</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
