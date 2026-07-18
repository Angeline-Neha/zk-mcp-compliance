pragma circom 2.1.9;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * refundPolicy — Phase 3
 *
 * Proves: "I evaluated the registered refund policy predicate over my real
 * (private) transaction data, using the registered (committed) policy
 * parameters, and it returned APPROVE — without revealing the transaction
 * data or the policy parameters themselves."
 *
 * Thresholds are locked in docs/policy-sources.md — ZK-MCP Reference Refund
 * Policy v1 (amount / account-age / refund-count) + the cited 120-day
 * industry chargeback-filing window (transaction-age). Every constant below
 * traces back to that document; none are invented here.
 *
 * approved output semantics: 0 means "escalate to human review," not
 * "reject" — per policy-sources.md point (4).
 */
template RefundPolicy() {
    // ---- private inputs: real transaction data, never revealed ----
    signal input amount;              // requested refund amount
    signal input accountAgeDays;      // how old the requesting account is
    signal input pastRefundCount;     // refunds in the preceding 90 days
    signal input transactionAgeDays;  // days since the original transaction

    // ---- private inputs: the actual policy parameters + commitment salt ----
    // these are private so the circuit can prove "I used the REAL policy"
    // without the policy's numeric values appearing anywhere on-chain/in-log
    signal input policyLimit;           // 150, per policy-sources.md (1)
    signal input minAccountAgeDays;     // 30,  per policy-sources.md (2)
    signal input maxPastRefundCount;    // 3,   per policy-sources.md (3)
    signal input maxTransactionAgeDays; // 120, per policy-sources.md (cited)
    signal input policyLimitSalt;       // salt for the commitment

    // ---- private input: blinding salt for the amount commitment ----
    signal input amountSalt;

    // ---- public inputs: revealed, but reveal nothing sensitive alone ----
    signal input policyCommitment; // Poseidon(policyLimit, minAccountAgeDays,
                                    //   maxPastRefundCount, maxTransactionAgeDays,
                                    //   policyLimitSalt) — must match the
                                    //   value registered with issuer-service

    signal output approved;
    // amountCommitment binds the amount actually PROVEN compliant to the
    // amount the gate will actually execute against the real ledger. Without
    // this, nothing stops an agent from proving compliance for a small
    // amount and then telling the gate to execute a completely different,
    // larger one — the gate re-derives Poseidon(claimedAmount, claimedSalt)
    // itself and checks it matches this output before running real tool
    // logic. amount itself is never revealed, only this commitment.
    signal output amountCommitment;

    // -------------------------------------------------------------------
    // Check 0 — policy-commitment check. Fails the circuit if the agent
    // swapped in different (e.g. more lenient) policy parameters than the
    // ones actually registered. This is the check that stops Attack #7
    // (fake compliance proof / forged policy).
    // -------------------------------------------------------------------
    component commitCheck = Poseidon(5);
    commitCheck.inputs[0] <== policyLimit;
    commitCheck.inputs[1] <== minAccountAgeDays;
    commitCheck.inputs[2] <== maxPastRefundCount;
    commitCheck.inputs[3] <== maxTransactionAgeDays;
    commitCheck.inputs[4] <== policyLimitSalt;
    commitCheck.out === policyCommitment;

    // -------------------------------------------------------------------
    // Check 1 — amount <= policyLimit  (policy-sources.md point 1)
    // -------------------------------------------------------------------
    component amountCheck = LessEqThan(64);
    amountCheck.in[0] <== amount;
    amountCheck.in[1] <== policyLimit;

    // -------------------------------------------------------------------
    // Check 2 — accountAgeDays >= minAccountAgeDays  (point 2)
    // -------------------------------------------------------------------
    component ageCheck = GreaterEqThan(32);
    ageCheck.in[0] <== accountAgeDays;
    ageCheck.in[1] <== minAccountAgeDays;

    // -------------------------------------------------------------------
    // Check 3 — pastRefundCount < maxPastRefundCount  (point 3)
    // -------------------------------------------------------------------
    component refundCountCheck = LessThan(32);
    refundCountCheck.in[0] <== pastRefundCount;
    refundCountCheck.in[1] <== maxPastRefundCount;

    // -------------------------------------------------------------------
    // Check 4 — transactionAgeDays <= maxTransactionAgeDays  (cited: 120-day
    // industry chargeback-filing window)
    // -------------------------------------------------------------------
    component txAgeCheck = LessEqThan(32);
    txAgeCheck.in[0] <== transactionAgeDays;
    txAgeCheck.in[1] <== maxTransactionAgeDays;

    // approved = AND of all four boolean checks (commitment check is
    // enforced structurally above via ===, not part of this AND — a
    // wrong commitment fails circuit satisfaction entirely, it doesn't
    // just flip approved to 0)
    signal and1;
    signal and2;
    signal and3;
    and1 <== amountCheck.out * ageCheck.out;
    and2 <== and1 * refundCountCheck.out;
    and3 <== and2 * txAgeCheck.out;

    approved <== and3;

    component amountCommit = Poseidon(2);
    amountCommit.inputs[0] <== amount;
    amountCommit.inputs[1] <== amountSalt;
    amountCommitment <== amountCommit.out;
}

component main {public [policyCommitment]} = RefundPolicy();