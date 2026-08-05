import { describe, it, expect } from "vitest";
import { evaluatePolicy, POLICY } from "../src/policy";

describe("baseline-agent policy predicate (plain code, mirrors the secure system's circuit thresholds)", () => {
  const compliant = {
    amount: 100,
    accountAgeDays: 60,
    pastRefundCount: 0,
    transactionAgeDays: 10,
  };

  it("approves an order that satisfies all four conditions", () => {
    expect(evaluatePolicy(compliant)).toEqual({ approved: true });
  });

  it("rejects an order over the amount limit", () => {
    const result = evaluatePolicy({ ...compliant, amount: POLICY.policyLimit + 1 });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/exceeds/);
  });

  it("rejects an account younger than the minimum age", () => {
    const result = evaluatePolicy({ ...compliant, accountAgeDays: POLICY.minAccountAgeDays - 1 });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/below/);
  });

  it("rejects a customer at or over the past-refund-count limit", () => {
    const result = evaluatePolicy({ ...compliant, pastRefundCount: POLICY.maxPastRefundCount });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/refund/);
  });

  it("rejects a transaction older than the refund window", () => {
    const result = evaluatePolicy({ ...compliant, transactionAgeDays: POLICY.maxTransactionAgeDays + 1 });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/window/);
  });
});
