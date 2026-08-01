export function BreachComparison() {
  return (
    <div className="bg-[#E6DCC8] border border-[rgba(31,27,22,0.15)] rounded-sm p-5">
      <h3 className="font-stamp text-lg mb-4 text-[#1F1B16] uppercase tracking-widest border-b border-[rgba(31,27,22,0.1)] pb-2">
        Breach Comparison: Intent Binding vs Baseline
      </h3>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Baseline (OAuth/JWT) */}
        <div className="flex flex-col">
          <div className="bg-[rgba(178,58,47,0.05)] border border-[rgba(178,58,47,0.3)] p-4 rounded-sm flex-1">
            <h4 className="font-mono-data text-[10px] text-[#B23A2F] uppercase mb-3 tracking-widest">
              Standard Architecture (OAuth/JWT)
            </h4>
            <div className="font-mono-data text-[9px] text-[#1F1B16] opacity-70 whitespace-pre overflow-x-auto">
{`[API Gateway] POST /refund HTTP/1.1
Authorization: Bearer eyJhbGci... (Valid Support JWT)

{ "orderRef": "9101", "amount": 50, "reason": "damaged" }

[Access Control] Token valid. Scope: "refund:issue" matches.
[Execution] Refund 9101 processed successfully.

[!] FATAL: Support agent hijacked by prompt injection.
[!] Attacker successfully refunded arbitrary compliant order.`}
            </div>
            <div className="mt-4 border-t border-[rgba(178,58,47,0.2)] pt-3 text-[#B23A2F] font-stamp text-xs text-center uppercase">
              Result: Catastrophic Success
            </div>
          </div>
        </div>

        {/* ZK-MCP */}
        <div className="flex flex-col">
          <div className="bg-[rgba(47,74,59,0.05)] border border-[rgba(47,74,59,0.3)] p-4 rounded-sm flex-1">
            <h4 className="font-mono-data text-[10px] text-[#2F4A3B] uppercase mb-3 tracking-widest">
              Zero-Trust Architecture (ZK-MCP)
            </h4>
            <div className="font-mono-data text-[9px] text-[#1F1B16] opacity-70 whitespace-pre overflow-x-auto">
{`[Finance Gate] Evaluating MCP Tool Call: "issue_refund"

[Check 1] Attestation valid?        [PASS]
[Check 2] Proof 1 (Sigma) valid?    [PASS]
[Check 3] Proof 2 (Groth16) valid?  [PASS] (9101 is compliant)
[Check 4] Intent Binding...

Expected Intent Hash:  8e2f1a3b... (Order 9102)
Target Order Ref:      9101
Hash(9101, nonce):     4c9f001a... 

[!] MISMATCH: Intent does not match cryptographic commitment.
[Execution] HALTED.`}
            </div>
            <div className="mt-4 border-t border-[rgba(47,74,59,0.2)] pt-3 text-[#2F4A3B] font-stamp text-xs text-center uppercase">
              Result: Blocked by Cryptography
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
