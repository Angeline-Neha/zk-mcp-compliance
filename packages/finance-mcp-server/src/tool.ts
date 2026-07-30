import { z } from "zod";
import { runGate, GateInput } from "./gate";
import { loadOrderContext, executeRefund } from "./db";

export const issueRefundInputSchema = z.object({
  agentId: z.string().min(1),
  attestationId: z.string().uuid(),
  requestedScope: z.object({ action: z.literal("issue_refund"), limit: z.number().optional() }),
  sigmaProof: z.object({ R: z.string(), s: z.string() }),
  nonce: z.string().min(1),
  orderRef: z.string().min(1),
  claimedAmount: z.number().positive(),
  claimedAmountSalt: z.string().min(1),
  complianceProof: z.object({
    proof: z.any(),
    publicSignals: z.array(z.string()),
  }),
  /** Attack 8: session that produced the authenticated intent commitment. */
  sessionId: z.string().optional(),
  /**
   * Attack 8: SHA-256 hex commitment hash from POST /intent-commitment.
   * Must match what was bound into the Fiat-Shamir challenge for Proof 1.
   */
  intentCommitmentHash: z.string().optional(),
  proof2Meta: z
    .object({ durationMs: z.number(), proofSizeBytes: z.number() })
    .optional(),
});

export type IssueRefundInput = z.infer<typeof issueRefundInputSchema>;

export interface IssueRefundResult {
  allowed: boolean;
  reason?: string;
  refundId?: string;
  orderContext?: {
    accountAgeDays: number;
    pastRefundCount: number;
    transactionAgeDays: number;
  };
  inspector?: any;
  proof1Valid?: boolean;
  proof2Valid?: boolean;
  intentBindingFail?: boolean;
}

const SERVER_ID = "finance-mcp-server";

/**
 * The full issue_refund flow: verify BOTH proofs through the gate, and only
 * if allowed, actually mutate the real ledger. This function is the same
 * one the MCP tool handler calls — kept separate so it can be exercised
 * directly (curl-equivalent, no agent, no MCP transport) per the roadmap's
 * instruction to prove the gate is airtight before any agent exists.
 */
export async function handleIssueRefund(input: IssueRefundInput): Promise<IssueRefundResult> {
  const orderContext = await loadOrderContext(input.orderRef);
  if (!orderContext) {
    return { allowed: false, reason: `order ${input.orderRef} not found` };
  }

  // the amount actually being executed is the REAL order amount from the
  // ledger — never trust a claimedAmount that doesn't match the real order.
  // This is on top of the circuit's own amount-binding check: that binds
  // "proof amount" to "claimed amount", this binds "claimed amount" to
  // "the real amount on the actual order."
  if (input.claimedAmount !== orderContext.amount) {
    return {
      allowed: false,
      reason: `claimedAmount (${input.claimedAmount}) does not match the real order amount (${orderContext.amount})`,
    };
  }

  const gateInput: GateInput = {
    agentId: input.agentId,
    attestationId: input.attestationId,
    requestedScope: input.requestedScope,
    sigmaProof: input.sigmaProof,
    nonce: input.nonce,
    serverId: SERVER_ID,
    toolName: "issue_refund",
    circuitId: "refundPolicy",
    complianceProof: input.complianceProof,
    claimedAmount: input.claimedAmount,
    claimedAmountSalt: input.claimedAmountSalt,
    sessionId: input.sessionId,
    intentCommitmentHash: input.intentCommitmentHash,
    orderRef: input.orderRef,
    proof2Meta: input.proof2Meta,
  };

  const gateResult = await runGate(gateInput);
  if (!gateResult.allowed) {
    return {
      allowed: false,
      reason: gateResult.reason,
      orderContext: publicContext(orderContext),
      inspector: gateResult.inspector,
      proof1Valid: gateResult.proof1Valid,
      proof2Valid: gateResult.proof2Valid,
      intentBindingFail: gateResult.intentBindingFail,
    };
  }

  const { refundId } = await executeRefund(orderContext.orderId, orderContext.amount, input.agentId);

  return {
    allowed: true,
    refundId,
    orderContext: publicContext(orderContext),
    inspector: gateResult.inspector,
    proof1Valid: true,
    proof2Valid: true,
  };
}

/**
 * Read-only order lookup, no gate required — this isn't a privileged
 * action, just a query. Agents need this to decide what to do before
 * attempting a privileged tool call; the ACTUAL refund still goes through
 * the full two-proof gate via handleIssueRefund above.
 */
export async function lookupOrder(orderRef: string) {
  const ctx = await loadOrderContext(orderRef);
  if (!ctx) return null;
  return {
    orderRef,
    amount: ctx.amount,
    accountAgeDays: ctx.accountAgeDays,
    pastRefundCount: ctx.pastRefundCount,
    transactionAgeDays: ctx.transactionAgeDays,
  };
}

function publicContext(ctx: {
  accountAgeDays: number;
  pastRefundCount: number;
  transactionAgeDays: number;
}) {
  return {
    accountAgeDays: ctx.accountAgeDays,
    pastRefundCount: ctx.pastRefundCount,
    transactionAgeDays: ctx.transactionAgeDays,
  };
}
