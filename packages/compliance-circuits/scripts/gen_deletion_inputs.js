const { buildPoseidon } = require("circomlibjs");
const { createHash } = require("crypto");
const fs = require("fs");

/**
 * Deterministic accountRef -> field element mapping. SHA-256 truncated to
 * 31 bytes (248 bits) is safely under BN128's ~254-bit field size. Both
 * the agent (when generating a proof) and the gate (when checking it)
 * must use this exact same function so their commitments match.
 */
function accountRefToFieldElement(accountRef) {
  const hash = createHash("sha256").update(accountRef).digest();
  return BigInt("0x" + hash.subarray(0, 31).toString("hex")).toString();
}

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const retentionFloorDays = 2555; // 7 years, per docs/policy-sources.md (cited)
  const policyLimitSalt = "77123409128374091827340918273"; // fixed salt for this demo policy version

  const hash = poseidon([retentionFloorDays, policyLimitSalt]);
  const policyCommitment = F.toObject(hash).toString();

  console.log("deletionPolicy commitment:", policyCommitment);

  const accountId = accountRefToFieldElement("acct-001");
  const accountIdSalt = "51928374012938470129384701293";

  const basePolicy = {
    retentionFloorDays: retentionFloorDays.toString(),
    policyLimitSalt,
    policyCommitment,
    accountId,
    accountIdSalt,
  };

  // 1. VALID: consented, dependency-free, retention floor passed
  fs.writeFileSync(
    "inputs/deletion_valid.json",
    JSON.stringify(
      { consentGiven: "1", daysSinceLastTransaction: "3000", hasActiveDependency: "0", ...basePolicy },
      null,
      2
    )
  );

  // 2. RETENTION FLOOR VIOLATION: consented, no dependency, but too recent
  fs.writeFileSync(
    "inputs/deletion_retention_violation.json",
    JSON.stringify(
      { consentGiven: "1", daysSinceLastTransaction: "100", hasActiveDependency: "0", ...basePolicy },
      null,
      2
    )
  );

  // 3. NO CONSENT
  fs.writeFileSync(
    "inputs/deletion_no_consent.json",
    JSON.stringify(
      { consentGiven: "0", daysSinceLastTransaction: "3000", hasActiveDependency: "0", ...basePolicy },
      null,
      2
    )
  );

  // 4. ACTIVE DEPENDENCY
  fs.writeFileSync(
    "inputs/deletion_active_dependency.json",
    JSON.stringify(
      { consentGiven: "1", daysSinceLastTransaction: "3000", hasActiveDependency: "1", ...basePolicy },
      null,
      2
    )
  );

  // 5. FORGED POLICY (Attack #7 for this tool)
  fs.writeFileSync(
    "inputs/deletion_forged_policy.json",
    JSON.stringify(
      {
        consentGiven: "1",
        daysSinceLastTransaction: "100",
        hasActiveDependency: "0",
        retentionFloorDays: "10", // forged
        policyLimitSalt,
        policyCommitment,
        accountId,
        accountIdSalt,
      },
      null,
      2
    )
  );

  console.log("wrote 5 deletionPolicy input files under inputs/");
  console.log("accountId field element for 'acct-001':", accountId);
}

main();