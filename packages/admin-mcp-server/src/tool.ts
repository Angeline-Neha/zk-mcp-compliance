import { z } from "zod";
import { runGate, GateInput } from "./gate";
import { getAccount, markAccountDeleted } from "./db";
import { accountRefToFieldElement } from "./accountId";

export const deleteAccountInputSchema = z.object({
  agentId: z.string().min(1),
  attestationId: z.string().uuid(),
  requestedScope: z.object({ action: z.literal("delete_account") }),
  sigmaProof: z.object({ R: z.string(), s: z.string() }),
  nonce: z.string().min(1),
  accountRef: z.string().min(1),
  claimedAccountIdSalt: z.string().min(1),
  complianceProof: z.object({
    proof: z.any(),
    publicSignals: z.array(z.string()),
  }),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

const SERVER_ID = "admin-mcp-server";

export async function handleDeleteAccount(input: DeleteAccountInput) {
  const account = await getAccount(input.accountRef);
  if (!account) {
    return { allowed: false, reason: `account ${input.accountRef} not found` };
  }
  if (account.deleted) {
    return { allowed: false, reason: `account ${input.accountRef} already deleted` };
  }

  const gateInput: GateInput = {
    agentId: input.agentId,
    attestationId: input.attestationId,
    requestedScope: input.requestedScope,
    sigmaProof: input.sigmaProof,
    nonce: input.nonce,
    toolName: "delete_account",
    circuitId: "deletionPolicy",
    complianceProof: input.complianceProof,
    claimedAccountId: accountRefToFieldElement(input.accountRef),
    claimedAccountIdSalt: input.claimedAccountIdSalt,
  };

  const gateResult = await runGate(gateInput);
  if (!gateResult.allowed) {
    return { allowed: false, reason: gateResult.reason };
  }

  await markAccountDeleted(account.id);
  return { allowed: true, accountRef: input.accountRef };
}

/**
 * Read-only account lookup, no gate required — same role as finance-mcp-
 * server's lookup_order. Also returns the accountId field-element
 * encoding so a caller (agent) can generate a compliance proof using the
 * exact same value the gate will independently re-derive.
 */
export async function lookupAccount(accountRef: string) {
  const account = await getAccount(accountRef);
  if (!account) return null;
  return {
    accountRef: account.accountRef,
    consentGiven: account.consentGiven,
    daysSinceLastTransaction: account.daysSinceLastTransaction,
    hasActiveDependency: account.hasActiveDependency,
    deleted: account.deleted,
    accountIdFieldElement: accountRefToFieldElement(account.accountRef),
  };
}