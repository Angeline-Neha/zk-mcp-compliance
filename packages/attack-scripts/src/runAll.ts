import { attack1_replay } from "./attacks/attack1_replay";
import { attack2_confusedDeputy } from "./attacks/attack2_confusedDeputy";
import { attack3_escalation } from "./attacks/attack3_escalation";
import { attack4_lateralMovement } from "./attacks/attack4_lateralMovement";
import { attack5_crossServerReuse } from "./attacks/attack5_crossServerReuse";
import { attack6_toctou } from "./attacks/attack6_toctou";
import { attack7_fakeComplianceProof } from "./attacks/attack7_fakeComplianceProof";
import { attack8_intentInjection } from "./attacks/attack8_intentInjection";
import { AttackResult } from "./common";
import { realPolicyCommitment, ISSUER_URL } from "./common";

const ATTACKS: (() => Promise<AttackResult>)[] = [
  attack1_replay,
  attack2_confusedDeputy,
  attack3_escalation,
  attack4_lateralMovement,
  attack5_crossServerReuse,
  attack6_toctou,
  attack7_fakeComplianceProof,
  attack8_intentInjection,
];

async function ensurePolicyCommitmentRegistered() {
  const commitment = await realPolicyCommitment();
  await fetch(`${ISSUER_URL}/policy-commitment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolScope: "issue_refund", commitmentHex: commitment }),
  });
}

async function main() {
  console.log("Ensuring policy commitment is registered...");
  await ensurePolicyCommitmentRegistered();

  console.log("\n=== Running all 8 live attacks against the real running stack ===\n");

  const results: AttackResult[] = [];
  for (const attack of ATTACKS) {
    const name = attack.name;
    try {
      const result = await attack();
      results.push(result);
      const status = result.blocked ? "✅ BLOCKED" : "❌ VULNERABLE";
      console.log(`${status}  ${result.attack}`);
      console.log(`         ${result.reason}\n`);
    } catch (err: any) {
      results.push({ attack: name, blocked: false, reason: `SCRIPT ERROR: ${err.message}` });
      console.log(`⚠️  ERROR   ${name}`);
      console.log(`         ${err.message}\n`);
    }
  }

  const blockedCount = results.filter((r) => r.blocked).length;
  console.log("=== Summary ===");
  console.log(`${blockedCount}/${results.length} attacks blocked`);

  if (blockedCount !== results.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});