const { buildPoseidon } = require("circomlibjs");
const fs = require("fs");

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // The real, locked policy parameters per docs/policy-sources.md
  const policyLimit = 150;
  const minAccountAgeDays = 30;
  const maxPastRefundCount = 3;
  const maxTransactionAgeDays = 120;
  const policyLimitSalt = "48972134501928471234509182734"; // fixed salt for this demo policy version

  const hash = poseidon([
    policyLimit,
    minAccountAgeDays,
    maxPastRefundCount,
    maxTransactionAgeDays,
    policyLimitSalt,
  ]);
  const policyCommitment = F.toObject(hash).toString();

  console.log("policyCommitment:", policyCommitment);

  const basePolicy = {
    policyLimit: policyLimit.toString(),
    minAccountAgeDays: minAccountAgeDays.toString(),
    maxPastRefundCount: maxPastRefundCount.toString(),
    maxTransactionAgeDays: maxTransactionAgeDays.toString(),
    policyLimitSalt,
    policyCommitment,
  };

  const amountSalt = "9182736450918273645091827364";

  // 1. VALID: a real refund request that satisfies every threshold
  fs.writeFileSync(
    "inputs/valid.json",
    JSON.stringify(
      {
        amount: "100",
        accountAgeDays: "45",
        pastRefundCount: "1",
        transactionAgeDays: "10",
        amountSalt,
        ...basePolicy,
      },
      null,
      2
    )
  );

  // 2. THRESHOLD-VIOLATING: honest policy, but the transaction itself fails
  //    (amount over the limit) — proves the circuit actually enforces the
  //    threshold, not just that it runs
  fs.writeFileSync(
    "inputs/threshold_violation.json",
    JSON.stringify(
      {
        amount: "5000", // way over policyLimit of 150
        accountAgeDays: "45",
        pastRefundCount: "1",
        transactionAgeDays: "10",
        amountSalt,
        ...basePolicy,
      },
      null,
      2
    )
  );

  // 3. FORGED POLICY (Attack #7): agent tries to submit inputs using a much
  //    more lenient policyLimit (e.g. 999999) than the one actually
  //    registered, while still claiming the REAL policyCommitment publicly.
  //    This must fail circuit SATISFACTION itself (not just the boolean
  //    check) at the commitCheck.out === policyCommitment constraint.
  fs.writeFileSync(
    "inputs/forged_policy.json",
    JSON.stringify(
      {
        amount: "5000", // would fail the real policy, "approved" if forged policy were used
        accountAgeDays: "45",
        pastRefundCount: "1",
        transactionAgeDays: "10",
        amountSalt,
        policyLimit: "999999", // forged — much more lenient than the real 150
        minAccountAgeDays: "30",
        maxPastRefundCount: "3",
        maxTransactionAgeDays: "120",
        policyLimitSalt,
        policyCommitment, // still claims the REAL commitment
      },
      null,
      2
    )
  );

  console.log("wrote inputs/valid.json, inputs/threshold_violation.json, inputs/forged_policy.json");
}

main();