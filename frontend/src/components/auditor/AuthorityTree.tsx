export function AuthorityTree() {
  return (
    <div className="bg-[#1E1530] border border-[rgba(233,228,242,0.15)] rounded-sm p-5 h-full">
      <h3 className="font-stamp text-lg mb-6 text-[#E9E4F2] uppercase tracking-widest border-b border-[rgba(233,228,242,0.1)] pb-2">
        Authority Delegation Tree
      </h3>
      
      <div className="flex flex-col items-center pt-2 pb-6">
        {/* Root Node */}
        <div className="border-2 border-[#E9E4F2] px-4 py-2 bg-[#0D0817] z-10">
          <div className="font-stamp text-sm">Root Issuer</div>
          <div className="font-mono-data text-[10px] text-center opacity-70 mt-1">Unlimited</div>
        </div>

        {/* Thick line down */}
        <div className="w-1 h-6 bg-[#E9E4F2]"></div>

        {/* Agent A */}
        <div className="border border-[#E9E4F2] px-4 py-2 bg-[#0D0817] z-10 flex flex-col items-center min-w-[120px]">
          <div className="font-stamp text-xs">Agent A</div>
          <div className="font-mono-data text-[10px] text-center text-[#54C99A] mt-1">$100 Limit</div>
        </div>

        <div className="flex w-full justify-center relative mt-0">
          {/* Connecting lines */}
          <div className="absolute w-[180px] h-[1px] bg-[#E9E4F2] top-[12px] opacity-50"></div>
          
          {/* Branch 1 */}
          <div className="flex flex-col items-center w-1/2 pt-[12px]">
            <div className="w-[1px] h-4 bg-[#E9E4F2] opacity-50"></div>
            <div className="border border-[rgba(233,228,242,0.5)] px-3 py-1 bg-[#0D0817] z-10 flex flex-col items-center">
              <div className="font-stamp text-[10px]">Agent B</div>
              <div className="font-mono-data text-[9px] text-[#54C99A] mt-1">$50 Limit</div>
            </div>
            {/* Escalation Attempt (Broken line) */}
            <div className="w-[1px] h-6 border-l-2 border-dashed border-[#E15068] mt-1"></div>
            <div className="border border-[#E15068] bg-[rgba(225,80,104,0.05)] px-3 py-1 z-10 flex flex-col items-center relative">
              <div className="font-stamp text-[10px] text-[#E15068]">Agent C</div>
              <div className="font-mono-data text-[9px] text-[#E15068] mt-1">$50,000 Limit</div>
              <div className="absolute -right-24 top-2 font-stamp text-[8px] text-[#E15068] bg-[rgba(225,80,104,0.1)] px-1 rotate-3">
                ESCALATION DENIED
              </div>
            </div>
          </div>

          {/* Branch 2 */}
          <div className="flex flex-col items-center w-1/2 pt-[12px]">
            <div className="w-[1px] h-4 bg-[#E9E4F2] opacity-50"></div>
            <div className="border border-[rgba(233,228,242,0.5)] px-3 py-1 bg-[#0D0817] z-10 flex flex-col items-center">
              <div className="font-stamp text-[10px]">Agent D</div>
              <div className="font-mono-data text-[9px] text-[#54C99A] mt-1">$30 Limit</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
