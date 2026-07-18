import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, generateProof } from "@zk-mcp/sigma-core";
import { buildPoseidon } from "circomlibjs";
import { handleIssueRefund } from "../src/tool";
import { pool } from "../src/db";

const ISSUER = "http://localhost:4001";
const PROVING = "http://localhost:4002";

const POLICY = {
  policyLimit: 150,
  minAccountAgeDays: 30,
  maxPastRefundCount: 3,
  maxTransactionAgeDays: 120,
  policyLimitSalt: "48972134501928471234509182734",
};
const AMOUNT_SALT_BASE = "9182736450918273645091827364";

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

async function registerAgent(agentId: string, limit: number) {
  const { secretKey, publicKey } = generateKeyPair();
  const res = await fetch(`${ISSUER}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      publicKey,
      scope: { action: "issue_refund", limit },
      expirySeconds: 3600,
    }),
  });
  const body = await res.json();
  return { secretKey, publicKey, attestationId: body.attestation.id };
}

async function getNonce(serverId: string) {
  const res = await fetch(`${ISSUER}/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "issue_refund", serverId }),
  });
  return (await res.json()).nonce as string;
}

async function proveCompliance(input: Record<string, string>) {
  const res = await fetch(`${PROVING}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuitId: "refundPolicy", input }),
  });
  return { status: res.status, body: await res.json() };
}

function circuitInput(overrides: {
  amount: number;
  accountAgeDays: number;
  pastRefundCount: number;
  transactionAgeDays: number;
  amountSalt: string;
  policyCommitment: string;
  policyLimit?: number;
}) {
  return {
    amount: overrides.amount.toString(),
    accountAgeDays: overrides.accountAgeDays.toString(),
    pastRefundCount: overrides.pastRefundCount.toString(),
    transactionAgeDays: overrides.transactionAgeDays.toString(),
    amountSalt: overrides.amountSalt,
    policyLimit: (overrides.policyLimit ?? POLICY.policyLimit).toString(),
    minAccountAgeDays: POLICY.minAccountAgeDays.toString(),
    maxPastRefundCount: POLICY.maxPastRefundCount.toString(),
    maxTransactionAgeDays: POLICY.maxTransactionAgeDays.toString(),
    policyLimitSalt: POLICY.policyLimitSalt,
    policyCommitment: overrides.policyCommitment,
  };
}

beforeAll(async () => {
  // ensure the real policy commitment is registered with issuer-service
  const commitment = await realPolicyCommitment();
  await fetch(`${ISSUER}/policy-commitment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolScope: "issue_refund", commitmentHex: commitment }),
  });
});

describe("finance-mcp-server gate — full real pipeline, order 4521 (cust-001, $100, compliant)", () => {
  it("allows a genuinely compliant refund end to end and actually inserts a refund row", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-1", 500);
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund",
      nonce,
      serverId: "finance-mcp-server",
    });

    const policyCommitment = await realPolicyCommitment();
    const amountSalt = AMOUNT_SALT_BASE + "1";
    const { status, body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 100,
        accountAgeDays: 45,
        pastRefundCount: 0,
        transactionAgeDays: 10,
        amountSalt,
        policyCommitment,
      })
    );
    expect(status).toBe(200);

    const result = await handleIssueRefund({
      agentId: "support-agent-e2e-1",
      attestationId,
      requestedScope: { action: "issue_refund", limit: 500 },
      sigmaProof,
      nonce,
      orderRef: "4521",
      claimedAmount: 100,
      claimedAmountSalt: amountSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(true);
    expect(result.refundId).toBeTypeOf("string");

    // confirm it's REALLY in the DB, not just a happy response
    const dbCheck = await pool.query(`SELECT * FROM refunds WHERE id = $1`, [result.refundId]);
    expect(dbCheck.rows.length).toBe(1);
    expect(Number(dbCheck.rows[0].amount)).toBe(100);
  }, 30000);

  it("REJECTS replay of the exact same proof pair (Attack #1)", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-2", 500);
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund",
      nonce,
      serverId: "finance-mcp-server",
    });
    const policyCommitment = await realPolicyCommitment();
    const amountSalt = AMOUNT_SALT_BASE + "2";
    const { body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 100, accountAgeDays: 45, pastRefundCount: 0, transactionAgeDays: 10,
        amountSalt, policyCommitment,
      })
    );

    const callArgs = {
      agentId: "support-agent-e2e-2",
      attestationId,
      requestedScope: { action: "issue_refund" as const, limit: 500 },
      sigmaProof,
      nonce,
      orderRef: "4521",
      claimedAmount: 100,
      claimedAmountSalt: amountSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    };

    const first = await handleIssueRefund(callArgs);
    expect(first.allowed).toBe(true);

    const second = await handleIssueRefund(callArgs);
    expect(second.allowed).toBe(false);
    expect(second.reason).toMatch(/nonce/);
  }, 30000);

  it("REJECTS an over-limit refund (order 4522, $5000) — proof verifies, but approved=0", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-3", 10000);
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund", nonce, serverId: "finance-mcp-server",
    });
    const policyCommitment = await realPolicyCommitment();
    const amountSalt = AMOUNT_SALT_BASE + "3";
    const { body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 5000, accountAgeDays: 45, pastRefundCount: 0, transactionAgeDays: 5,
        amountSalt, policyCommitment,
      })
    );

    const result = await handleIssueRefund({
      agentId: "support-agent-e2e-3",
      attestationId,
      requestedScope: { action: "issue_refund", limit: 10000 },
      sigmaProof, nonce,
      orderRef: "4522",
      claimedAmount: 5000,
      claimedAmountSalt: amountSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/APPROVE=false/);
  }, 30000);

  it("REJECTS a refund on a transaction outside the 120-day window (order 4523, 200 days old)", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-4", 500);
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund", nonce, serverId: "finance-mcp-server",
    });
    const policyCommitment = await realPolicyCommitment();
    const amountSalt = AMOUNT_SALT_BASE + "4";
    const { body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 80, accountAgeDays: 45, pastRefundCount: 0, transactionAgeDays: 200,
        amountSalt, policyCommitment,
      })
    );

    const result = await handleIssueRefund({
      agentId: "support-agent-e2e-4",
      attestationId,
      requestedScope: { action: "issue_refund", limit: 500 },
      sigmaProof, nonce,
      orderRef: "4523",
      claimedAmount: 80,
      claimedAmountSalt: amountSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/APPROVE=false/);
  }, 30000);

  it("REJECTS a refund for a too-new account (order 4524, cust-004, 5-day-old account)", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-5", 500);
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund", nonce, serverId: "finance-mcp-server",
    });
    const policyCommitment = await realPolicyCommitment();
    const amountSalt = AMOUNT_SALT_BASE + "5";
    const { body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 50, accountAgeDays: 5, pastRefundCount: 0, transactionAgeDays: 2,
        amountSalt, policyCommitment,
      })
    );

    const result = await handleIssueRefund({
      agentId: "support-agent-e2e-5",
      attestationId,
      requestedScope: { action: "issue_refund", limit: 500 },
      sigmaProof, nonce,
      orderRef: "4524",
      claimedAmount: 50,
      claimedAmountSalt: amountSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/APPROVE=false/);
  }, 30000);

  it("REJECTS when claimedAmount doesn't match the real order amount, even before touching the gate", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-6", 500);
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund", nonce, serverId: "finance-mcp-server",
    });
    const policyCommitment = await realPolicyCommitment();
    const amountSalt = AMOUNT_SALT_BASE + "6";
    const { body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 100, accountAgeDays: 45, pastRefundCount: 0, transactionAgeDays: 10,
        amountSalt, policyCommitment,
      })
    );

    const result = await handleIssueRefund({
      agentId: "support-agent-e2e-6",
      attestationId,
      requestedScope: { action: "issue_refund", limit: 500 },
      sigmaProof, nonce,
      orderRef: "4521", // real amount is 100
      claimedAmount: 999, // LYING about the amount
      claimedAmountSalt: amountSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/does not match the real order amount/);
  }, 30000);

  it("REJECTS a proof generated for a different serverId — cross-server reuse (Attack #5)", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-7", 500);
    // nonce requested for finance-mcp-server, but proof generated as if for admin-mcp-server
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund", nonce, serverId: "admin-mcp-server", // WRONG server bound into the proof
    });
    const policyCommitment = await realPolicyCommitment();
    const amountSalt = AMOUNT_SALT_BASE + "7";
    const { body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 100, accountAgeDays: 45, pastRefundCount: 0, transactionAgeDays: 10,
        amountSalt, policyCommitment,
      })
    );

    const result = await handleIssueRefund({
      agentId: "support-agent-e2e-7",
      attestationId,
      requestedScope: { action: "issue_refund", limit: 500 },
      sigmaProof, nonce,
      orderRef: "4521",
      claimedAmount: 100,
      claimedAmountSalt: amountSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Proof 1/);
  }, 30000);

  it("REJECTS a proof whose claimed policyCommitment doesn't match the ACTUALLY registered one — deeper Attack #7 defense", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-8", 500);
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund", nonce, serverId: "finance-mcp-server",
    });

    // Attacker forges an ENTIRELY self-consistent policy: uses a fake
    // policyLimit AND computes a matching fake policyCommitment for it.
    // The circuit itself is happy (internal consistency holds) — only a
    // check against the REGISTERED commitment (not just the circuit's own
    // internal Poseidon check) can catch this.
    const poseidon = await buildPoseidon();
    const fakeLimit = 999999;
    const fakeHash = poseidon([fakeLimit, 30, 3, 120, POLICY.policyLimitSalt]);
    const fakeCommitment = poseidon.F.toObject(fakeHash).toString();

    const amountSalt = AMOUNT_SALT_BASE + "8";
    const { status, body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 5000, // only passes under the FAKE, more lenient limit
        accountAgeDays: 45, pastRefundCount: 0, transactionAgeDays: 10,
        amountSalt,
        policyCommitment: fakeCommitment, // self-consistent with the fake policyLimit
        policyLimit: fakeLimit,
      })
    );
    expect(status).toBe(200); // circuit itself is satisfied — internally consistent

    const result = await handleIssueRefund({
      agentId: "support-agent-e2e-8",
      attestationId,
      requestedScope: { action: "issue_refund", limit: 500 },
      sigmaProof, nonce,
      orderRef: "4522", // doesn't matter, should be rejected before amount check even matters
      claimedAmount: 5000,
      claimedAmountSalt: amountSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/policyCommitment mismatch/);
  }, 30000);

  it("REJECTS when the amount used to generate the proof doesn't match claimedAmount (amount-binding check)", async () => {
    const { secretKey, publicKey, attestationId } = await registerAgent("support-agent-e2e-9", 500);
    const nonce = await getNonce("finance-mcp-server");
    const sigmaProof = generateProof(secretKey, publicKey, {
      scope: "issue_refund", nonce, serverId: "finance-mcp-server",
    });
    const policyCommitment = await realPolicyCommitment();
    const amountSalt = AMOUNT_SALT_BASE + "9";
    // proof proves amount=100 is compliant...
    const { body: proveBody } = await proveCompliance(
      circuitInput({
        amount: 100, accountAgeDays: 45, pastRefundCount: 0, transactionAgeDays: 10,
        amountSalt, policyCommitment,
      })
    );

    const result = await handleIssueRefund({
      agentId: "support-agent-e2e-9",
      attestationId,
      requestedScope: { action: "issue_refund", limit: 500 },
      sigmaProof, nonce,
      orderRef: "4521", // real order amount IS 100, matches claimedAmount below
      claimedAmount: 100,
      claimedAmountSalt: AMOUNT_SALT_BASE + "999", // a DIFFERENT valid salt than the one actually used in the proof
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/amount-binding mismatch/);
  }, 30000);
});
