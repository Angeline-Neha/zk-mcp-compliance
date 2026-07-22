export const ISSUER_URL = process.env.ISSUER_SERVICE_URL ?? "http://localhost:4001";
export const PROVING_URL = process.env.PROVING_SERVICE_URL ?? "http://localhost:4002";
export const FINANCE_URL = process.env.FINANCE_SERVICE_URL ?? "http://localhost:4003";
export const ADMIN_URL = process.env.ADMIN_SERVICE_URL ?? "http://localhost:4005";

export const POLICY = {
  policyLimit: 150,
  minAccountAgeDays: 30,
  maxPastRefundCount: 3,
  maxTransactionAgeDays: 120,
  policyLimitSalt: "48972134501928471234509182734",
};

export async function realPolicyCommitment(): Promise<string> {
  const { buildPoseidon } = await import("circomlibjs");
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

export async function registerAgent(agentId: string, scope: { action: string; limit?: number }) {
  const { generateKeyPair } = await import("@zk-mcp/sigma-core");
  const { secretKey, publicKey } = generateKeyPair();
  const res = await fetch(`${ISSUER_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, publicKey, scope, expirySeconds: 3600 }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`register failed: ${JSON.stringify(body)}`);
  return { secretKey, publicKey, attestationId: body.attestation.id as string };
}

export async function getNonce(scope: string, serverId: string): Promise<string> {
  const res = await fetch(`${ISSUER_URL}/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, serverId }),
  });
  return (await res.json()).nonce;
}

export async function sigmaProof(
  secretKey: string,
  publicKey: string,
  ctx: { scope: string; nonce: string; serverId: string }
) {
  const { generateProof } = await import("@zk-mcp/sigma-core");
  return generateProof(secretKey, publicKey, ctx);
}

export async function verifyProof1(body: Record<string, unknown>) {
  const res = await fetch(`${ISSUER_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function proveCompliance(input: Record<string, string>) {
  const res = await fetch(`${PROVING_URL}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuitId: "refundPolicy", input }),
  });
  return { status: res.status, body: await res.json() };
}

export function circuitInput(params: {
  amount: number;
  accountAgeDays: number;
  pastRefundCount: number;
  transactionAgeDays: number;
  amountSalt: string;
  policyCommitment: string;
  policyLimit?: number;
}) {
  return {
    amount: params.amount.toString(),
    accountAgeDays: params.accountAgeDays.toString(),
    pastRefundCount: params.pastRefundCount.toString(),
    transactionAgeDays: params.transactionAgeDays.toString(),
    amountSalt: params.amountSalt,
    policyLimit: (params.policyLimit ?? POLICY.policyLimit).toString(),
    minAccountAgeDays: POLICY.minAccountAgeDays.toString(),
    maxPastRefundCount: POLICY.maxPastRefundCount.toString(),
    maxTransactionAgeDays: POLICY.maxTransactionAgeDays.toString(),
    policyLimitSalt: POLICY.policyLimitSalt,
    policyCommitment: params.policyCommitment,
  };
}

export function randomSalt(): string {
  const { randomBytes } = require("crypto");
  return BigInt("0x" + randomBytes(16).toString("hex")).toString();
}

export interface AttackResult {
  attack: string;
  blocked: boolean;
  reason: string;
}