import { generateProof } from "@zk-mcp/sigma-core";
import { buildPoseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { POLICY } from "./policyConfig";
import { ISSUER_SERVICE_URL } from "./identity";

const PROVING_SERVICE_URL = process.env.PROVING_SERVICE_URL ?? "http://localhost:4002";
const SERVER_ID = "finance-mcp-server";

export interface OrderContext {
  amount: number;
  accountAgeDays: number;
  pastRefundCount: number;
  transactionAgeDays: number;
}

async function realPolicyCommitment(): Promise<string> {
  const poseidon = await buildPoseidon();
  const hash = poseidon([
    POLICY.policyLimit,
    POLICY.minAccountAgeDays,
    POLICY.maxPastRefundCount,
    POLICY.maxTransactionAgeDays,
    POLICY.policyLimitSalt,
  ]);
  return poseidon.F.toObject(hash).toString();
}

/**
 * Assembles everything needed to call finance-mcp-server's issue_refund
 * tool: a fresh nonce, a real sigma proof (Proof 1), and a real Groth16
 * proof (Proof 2) generated from the REAL order context. This is pure
 * infrastructure — the LLM never sees any of this, it only decides
 * WHETHER to attempt a refund; this function does the cryptographic work
 * of actually attempting it.
 *
 * Attack 8: when sessionIntentHash is provided, it is bound into the
 * Fiat-Shamir challenge (Proof 1) so the resulting sigma proof is
 * structurally incapable of authorising any action outside the
 * authenticated intent commitment for this session.
 */
export async function assembleRefundProofs(
  identity: { secretKey: string; publicKey: string; attestationId: string },
  order: OrderContext,
  sessionIntentHash?: string
) {
  // Proof 1: fresh nonce + sigma proof
  const nonceRes = await fetch(`${ISSUER_SERVICE_URL}/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "issue_refund", serverId: SERVER_ID }),
  });
  const { nonce } = await nonceRes.json();

  const sigmaCtx: { scope: string; nonce: string; serverId: string; intentCommitmentHash?: string } = {
    scope: "issue_refund",
    nonce,
    serverId: SERVER_ID,
  };
  if (sessionIntentHash) {
    sigmaCtx.intentCommitmentHash = sessionIntentHash;
  }

  const sigmaProof = generateProof(identity.secretKey, identity.publicKey, sigmaCtx);


  // Proof 2: real Groth16 proof from the real order context
  const policyCommitment = await realPolicyCommitment();
  // IMPORTANT: circom needs decimal numeric strings for field elements.
  // A plain hex string (randomBytes(16).toString("hex")) contains letters
  // a-f, which is NOT a valid BigInt literal and breaks witness generation
  // entirely — caught this via a real proof-generation failure during
  // testing, not by inspection. Converting through BigInt("0x"+hex) first
  // gives a proper decimal string.
  const amountSalt = BigInt("0x" + randomBytes(16).toString("hex")).toString();

  const proveRes = await fetch(`${PROVING_SERVICE_URL}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      circuitId: "refundPolicy",
      input: {
        amount: order.amount.toString(),
        accountAgeDays: order.accountAgeDays.toString(),
        pastRefundCount: order.pastRefundCount.toString(),
        transactionAgeDays: order.transactionAgeDays.toString(),
        amountSalt,
        policyLimit: POLICY.policyLimit.toString(),
        minAccountAgeDays: POLICY.minAccountAgeDays.toString(),
        maxPastRefundCount: POLICY.maxPastRefundCount.toString(),
        maxTransactionAgeDays: POLICY.maxTransactionAgeDays.toString(),
        policyLimitSalt: POLICY.policyLimitSalt,
        policyCommitment,
      },
    }),
  });

  if (!proveRes.ok) {
    // this is the real, hard cryptographic rejection path — e.g. a forged
    // policy attempt would land here, unable to even produce a witness.
    const body = await proveRes.json();
    throw new Error(`Compliance proof generation failed: ${body.error ?? proveRes.statusText}`);
  }

  const { proof, publicSignals } = await proveRes.json();

  return {
    sigmaProof,
    nonce,
    complianceProof: { proof, publicSignals },
    claimedAmount: order.amount,
    claimedAmountSalt: amountSalt,
    // Attack 8: returned so callers can forward it in the issue_refund args
    sessionIntentHash,
  };
}