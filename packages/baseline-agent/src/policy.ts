/**
 * The same four business thresholds the secure system's refundPolicy.circom
 * proves in zero-knowledge — here they're just an ordinary if-chain, exactly
 * how a competent developer would encode a refund policy in a normal
 * backend, with no cryptographic commitment or proof involved.
 */
export const POLICY = {
  policyLimit: 150,
  minAccountAgeDays: 30,
  maxPastRefundCount: 3,
  maxTransactionAgeDays: 120,
};

export interface PolicyCheckInput {
  amount: number;
  accountAgeDays: number;
  pastRefundCount: number;
  transactionAgeDays: number;
}

export function evaluatePolicy(order: PolicyCheckInput): { approved: boolean; reason?: string } {
  if (order.amount > POLICY.policyLimit) {
    return {
      approved: false,
      reason: `refund amount $${order.amount} exceeds the $${POLICY.policyLimit} auto-approval limit`,
    };
  }
  if (order.accountAgeDays < POLICY.minAccountAgeDays) {
    return {
      approved: false,
      reason: `account age ${order.accountAgeDays}d is below the ${POLICY.minAccountAgeDays}d minimum`,
    };
  }
  if (order.pastRefundCount >= POLICY.maxPastRefundCount) {
    return {
      approved: false,
      reason: `customer already has ${order.pastRefundCount} refund(s) in the past 90 days (limit ${POLICY.maxPastRefundCount})`,
    };
  }
  if (order.transactionAgeDays > POLICY.maxTransactionAgeDays) {
    return {
      approved: false,
      reason: `transaction is ${order.transactionAgeDays}d old, past the ${POLICY.maxTransactionAgeDays}d refund window`,
    };
  }
  return { approved: true };
}
