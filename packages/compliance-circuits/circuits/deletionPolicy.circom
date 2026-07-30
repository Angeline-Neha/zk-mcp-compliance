pragma circom 2.1.9;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * deletionPolicy — Phase 7
 *
 * Proves: "I evaluated the registered deletion policy predicate over my
 * real (private) account data, using the registered (committed) policy
 * parameters, and it returned APPROVE — without revealing the account
 * data or the policy parameters themselves."
 *
 * Thresholds locked in docs/policy-sources.md — ZK-MCP Reference Deletion
 * Policy v1 (consent + active-dependency, internal policy) + the cited
 * 7-year (2555-day) US financial-recordkeeping retention floor.
 *
 * approved output semantics: 0 means "deletion blocked" — this could be
 * for any of three independent reasons (no consent, active dependency,
 * retention floor not yet passed). Unlike refundPolicy, there is no
 * "escalate to human review" framing here — a blocked deletion is a hard
 * no until the blocking condition changes (consent given, dependency
 * resolved, or the retention floor passes with time).
 */
template DeletionPolicy() {
    // ---- private inputs: real account data, never revealed ----
    signal input consentGiven;            // 1 if the account holder explicitly consented, else 0
    signal input daysSinceLastTransaction; // days since the last financial transaction on this account
    signal input hasActiveDependency;      // 1 if there's an open order/dispute/subscription, else 0

    // ---- private inputs: the actual policy parameter + commitment salt ----
    signal input retentionFloorDays;   // 2555 (7 years), per policy-sources.md (cited)
    signal input policyLimitSalt;      // salt for the commitment

    // ---- private input: blinding salt for the account-id commitment ----
    signal input accountId;      // a field-element encoding of the real account being evaluated
    signal input accountIdSalt;

    // ---- public inputs: revealed, but reveal nothing sensitive alone ----
    signal input policyCommitment; // Poseidon(retentionFloorDays, policyLimitSalt) — must match
                                    //   the value registered with issuer-service

    signal output approved;
    // accountIdCommitment binds the account actually PROVEN compliant to
    // the account the gate will actually delete. Without this, nothing
    // stops an agent from proving compliance for one account and then
    // telling the gate to delete a completely different one — the gate
    // re-derives Poseidon(realAccountId, claimedSalt) itself and checks
    // it matches this output before running real tool logic. Same
    // pattern as refundPolicy.circom's amountCommitment fix.
    signal output accountIdCommitment;

    // -------------------------------------------------------------------
    // Check 0 — policy-commitment check. Fails the circuit if the agent
    // swapped in a different (e.g. shorter) retention floor than the one
    // actually registered. Same anti-forgery role as refundPolicy's
    // check — stops Attack #7 for this tool too.
    // -------------------------------------------------------------------
    component commitCheck = Poseidon(2);
    commitCheck.inputs[0] <== retentionFloorDays;
    commitCheck.inputs[1] <== policyLimitSalt;
    commitCheck.out === policyCommitment;

    // -------------------------------------------------------------------
    // Check 1 — consentGiven must be exactly 1 (policy-sources.md point 1)
    // -------------------------------------------------------------------
    component consentCheck = IsEqual();
    consentCheck.in[0] <== consentGiven;
    consentCheck.in[1] <== 1;

    // -------------------------------------------------------------------
    // Check 2 — daysSinceLastTransaction >= retentionFloorDays (cited:
    // 7-year / 2555-day US financial-recordkeeping retention floor).
    // This is the check that overrides consent — per policy-sources.md,
    // the mandatory floor blocks deletion "even if requested."
    // -------------------------------------------------------------------
    component retentionCheck = GreaterEqThan(32);
    retentionCheck.in[0] <== daysSinceLastTransaction;
    retentionCheck.in[1] <== retentionFloorDays;

    // -------------------------------------------------------------------
    // Check 3 — hasActiveDependency must be exactly 0 (policy-sources.md
    // point 2)
    // -------------------------------------------------------------------
    component dependencyCheck = IsEqual();
    dependencyCheck.in[0] <== hasActiveDependency;
    dependencyCheck.in[1] <== 0;

    signal and1;
    and1 <== consentCheck.out * retentionCheck.out;
    approved <== and1 * dependencyCheck.out;

    component accountCommit = Poseidon(2);
    accountCommit.inputs[0] <== accountId;
    accountCommit.inputs[1] <== accountIdSalt;
    accountIdCommitment <== accountCommit.out;
}

component main {public [policyCommitment]} = DeletionPolicy();