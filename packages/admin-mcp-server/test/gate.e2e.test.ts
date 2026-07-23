import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, generateProof } from "@zk-mcp/sigma-core";
import { buildPoseidon } from "circomlibjs";
import { createHash } from "crypto";
import { handleDeleteAccount } from "../src/tool";
import { pool } from "../src/db";
import { afterAll } from "vitest";

const ISSUER = "http://localhost:4001";
const PROVING = "http://localhost:4002";

const RETENTION_FLOOR_DAYS = 2555;
const POLICY_SALT = "77123409128374091827340918273";

function accountRefToFieldElement(accountRef: string): string {
  const hash = createHash("sha256").update(accountRef).digest();
  return BigInt("0x" + hash.subarray(0, 31).toString("hex")).toString();
}

async function realPolicyCommitment(): Promise<string> {
  const poseidon = await buildPoseidon();
  const hash = poseidon([RETENTION_FLOOR_DAYS, POLICY_SALT]);
  return poseidon.F.toObject(hash).toString();
}

async function registerAgent(agentId: string) {
  const { secretKey, publicKey } = generateKeyPair();
  const res = await fetch(`${ISSUER}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      publicKey,
      scope: { action: "delete_account" },
      expirySeconds: 3600,
    }),
  });
  const body = await res.json();
  return { secretKey, publicKey, attestationId: body.attestation.id };
}

async function getNonce() {
  const res = await fetch(`${ISSUER}/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "delete_account", serverId: "admin-mcp-server" }),
  });
  return (await res.json()).nonce as string;
}

async function proveDeletion(input: Record<string, string>) {
  const res = await fetch(`${PROVING}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuitId: "deletionPolicy", input }),
  });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  // 1. Existing policy registration
  const commitment = await realPolicyCommitment();
  await fetch(`${ISSUER}/policy-commitment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolScope: "delete_account", commitmentHex: commitment }),
  });

  // 2. NEW: Clean up any previous test runs
  await pool.query(`
    DELETE FROM accounts 
    WHERE account_ref IN ('acct-001', 'acct-002', 'acct-003', 'acct-004')
  `);

  // 3. NEW: Seed the database with the required test accounts
  await pool.query(`
    INSERT INTO accounts (account_ref, customer_id, deleted) 
    VALUES
      ('acct-001', 'cust-001', false),
      ('acct-002', 'cust-002', false),
      ('acct-003', 'cust-003', false),
      ('acct-004', 'cust-004', false)
  `);
});

afterAll(async () => {
  await pool.end();
});

describe("admin-mcp-server gate — full real pipeline", () => {
  it("allows a genuinely compliant deletion end to end and actually marks the account deleted (acct-001: consented, retention passed, no dependency)", async () => {
    const agent = await registerAgent("admin-agent-e2e-1");
    const nonce = await getNonce();
    const sigmaProof = generateProof(agent.secretKey, agent.publicKey, {
      scope: "delete_account",
      nonce,
      serverId: "admin-mcp-server",
    });

    const policyCommitment = await realPolicyCommitment();
    const accountIdSalt = "111222333444555666777888999";
    const { status, body: proveBody } = await proveDeletion({
      consentGiven: "1",
      daysSinceLastTransaction: "3000",
      hasActiveDependency: "0",
      retentionFloorDays: RETENTION_FLOOR_DAYS.toString(),
      policyLimitSalt: POLICY_SALT,
      policyCommitment,
      accountId: accountRefToFieldElement("acct-001"),
      accountIdSalt,
    });
    expect(status).toBe(200);

    const result = await handleDeleteAccount({
      agentId: "admin-agent-e2e-1",
      attestationId: agent.attestationId,
      requestedScope: { action: "delete_account" },
      sigmaProof,
      nonce,
      accountRef: "acct-001",
      claimedAccountIdSalt: accountIdSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(true);

    const dbCheck = await pool.query(`SELECT deleted FROM accounts WHERE account_ref = 'acct-001'`);
    expect(dbCheck.rows[0].deleted).toBe(true);
  }, 30000);

  it("REJECTS deletion when the retention floor hasn't passed (acct-002: only 100 days since last transaction)", async () => {
    const agent = await registerAgent("admin-agent-e2e-2");
    const nonce = await getNonce();
    const sigmaProof = generateProof(agent.secretKey, agent.publicKey, {
      scope: "delete_account",
      nonce,
      serverId: "admin-mcp-server",
    });

    const policyCommitment = await realPolicyCommitment();
    const accountIdSalt = "222333444555666777888999111";
    const { body: proveBody } = await proveDeletion({
      consentGiven: "1",
      daysSinceLastTransaction: "100",
      hasActiveDependency: "0",
      retentionFloorDays: RETENTION_FLOOR_DAYS.toString(),
      policyLimitSalt: POLICY_SALT,
      policyCommitment,
      accountId: accountRefToFieldElement("acct-002"),
      accountIdSalt,
    });

    const result = await handleDeleteAccount({
      agentId: "admin-agent-e2e-2",
      attestationId: agent.attestationId,
      requestedScope: { action: "delete_account" },
      sigmaProof,
      nonce,
      accountRef: "acct-002",
      claimedAccountIdSalt: accountIdSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/APPROVE=false/);
  }, 30000);

  it("REJECTS deletion when consent was not given (acct-003)", async () => {
    const agent = await registerAgent("admin-agent-e2e-3");
    const nonce = await getNonce();
    const sigmaProof = generateProof(agent.secretKey, agent.publicKey, {
      scope: "delete_account",
      nonce,
      serverId: "admin-mcp-server",
    });

    const policyCommitment = await realPolicyCommitment();
    const accountIdSalt = "333444555666777888999111222";
    const { body: proveBody } = await proveDeletion({
      consentGiven: "0",
      daysSinceLastTransaction: "3000",
      hasActiveDependency: "0",
      retentionFloorDays: RETENTION_FLOOR_DAYS.toString(),
      policyLimitSalt: POLICY_SALT,
      policyCommitment,
      accountId: accountRefToFieldElement("acct-003"),
      accountIdSalt,
    });

    const result = await handleDeleteAccount({
      agentId: "admin-agent-e2e-3",
      attestationId: agent.attestationId,
      requestedScope: { action: "delete_account" },
      sigmaProof,
      nonce,
      accountRef: "acct-003",
      claimedAccountIdSalt: accountIdSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/APPROVE=false/);
  }, 30000);

  it("REJECTS deletion when there's an active dependency (acct-004)", async () => {
    const agent = await registerAgent("admin-agent-e2e-4");
    const nonce = await getNonce();
    const sigmaProof = generateProof(agent.secretKey, agent.publicKey, {
      scope: "delete_account",
      nonce,
      serverId: "admin-mcp-server",
    });

    const policyCommitment = await realPolicyCommitment();
    const accountIdSalt = "444555666777888999111222333";
    const { body: proveBody } = await proveDeletion({
      consentGiven: "1",
      daysSinceLastTransaction: "3000",
      hasActiveDependency: "1",
      retentionFloorDays: RETENTION_FLOOR_DAYS.toString(),
      policyLimitSalt: POLICY_SALT,
      policyCommitment,
      accountId: accountRefToFieldElement("acct-004"),
      accountIdSalt,
    });

    const result = await handleDeleteAccount({
      agentId: "admin-agent-e2e-4",
      attestationId: agent.attestationId,
      requestedScope: { action: "delete_account" },
      sigmaProof,
      nonce,
      accountRef: "acct-004",
      claimedAccountIdSalt: accountIdSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/APPROVE=false/);
  }, 30000);

  it("REJECTS when the proof was generated for a DIFFERENT account than the one being deleted — account-binding check", async () => {
    const agent = await registerAgent("admin-agent-e2e-5");
    const nonce = await getNonce();
    const sigmaProof = generateProof(agent.secretKey, agent.publicKey, {
      scope: "delete_account",
      nonce,
      serverId: "admin-mcp-server",
    });

    const policyCommitment = await realPolicyCommitment();
    const accountIdSalt = "555666777888999111222333444";
    // proof honestly generated for acct-001's real (still-compliant-shaped) data...
    const { body: proveBody } = await proveDeletion({
      consentGiven: "1",
      daysSinceLastTransaction: "3000",
      hasActiveDependency: "0",
      retentionFloorDays: RETENTION_FLOOR_DAYS.toString(),
      policyLimitSalt: POLICY_SALT,
      policyCommitment,
      accountId: accountRefToFieldElement("acct-001"),
      accountIdSalt,
    });

    // ...but submitted against acct-002 instead
    const result = await handleDeleteAccount({
      agentId: "admin-agent-e2e-5",
      attestationId: agent.attestationId,
      requestedScope: { action: "delete_account" },
      sigmaProof,
      nonce,
      accountRef: "acct-002", // MISMATCH
      claimedAccountIdSalt: accountIdSalt,
      complianceProof: { proof: proveBody.proof, publicSignals: proveBody.publicSignals },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/account-binding mismatch/);
  }, 30000);
});

