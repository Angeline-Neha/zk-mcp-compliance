import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { buildPoseidon } from "circomlibjs";
import { createHash } from "crypto";

const RETENTION_FLOOR_DAYS = 2555;
const POLICY_SALT = "77123409128374091827340918273";
const ACCOUNT_ID_SALT = "51928374012938470129384701293";

function accountRefToFieldElement(accountRef: string): string {
  const hash = createHash("sha256").update(accountRef).digest();
  return BigInt("0x" + hash.subarray(0, 31).toString("hex")).toString();
}

async function realCommitment(): Promise<string> {
  const poseidon = await buildPoseidon();
  const hash = poseidon([RETENTION_FLOOR_DAYS, POLICY_SALT]);
  return poseidon.F.toObject(hash).toString();
}

async function accountIdCommitment(accountId: string, salt: string): Promise<string> {
  const poseidon = await buildPoseidon();
  const hash = poseidon([accountId, salt]);
  return poseidon.F.toObject(hash).toString();
}

function baseInput(overrides: Record<string, string>, policyCommitment: string) {
  return {
    consentGiven: "1",
    daysSinceLastTransaction: "3000",
    hasActiveDependency: "0",
    retentionFloorDays: RETENTION_FLOOR_DAYS.toString(),
    policyLimitSalt: POLICY_SALT,
    policyCommitment,
    accountId: accountRefToFieldElement("acct-001"),
    accountIdSalt: ACCOUNT_ID_SALT,
    ...overrides,
  };
}

describe("deletionPolicy — real Groth16 round trip", () => {
  it("generates a real proof for a fully-compliant deletion and it verifies true", async () => {
    const policyCommitment = await realCommitment();

    const proveRes = await request(app)
      .post("/prove")
      .send({ circuitId: "deletionPolicy", input: baseInput({}, policyCommitment) });

    expect(proveRes.status).toBe(200);
    // signal order: [approved, accountIdCommitment, policyCommitment]
    expect(proveRes.body.publicSignals[0]).toBe("1");

    const verifyRes = await request(app).post("/verify").send({
      circuitId: "deletionPolicy",
      proof: proveRes.body.proof,
      publicSignals: proveRes.body.publicSignals,
    });
    expect(verifyRes.body.valid).toBe(true);
  }, 30000);

  it("accountIdCommitment matches an independently recomputed Poseidon(accountId, salt) — what the gate checks to bind proven account to deleted account", async () => {
    const policyCommitment = await realCommitment();
    const proveRes = await request(app)
      .post("/prove")
      .send({ circuitId: "deletionPolicy", input: baseInput({}, policyCommitment) });

    const expected = await accountIdCommitment(accountRefToFieldElement("acct-001"), ACCOUNT_ID_SALT);
    expect(proveRes.body.publicSignals[1]).toBe(expected);
  }, 30000);

  it("blocks deletion when the retention floor hasn't passed — valid proof, approved=0", async () => {
    const policyCommitment = await realCommitment();
    const proveRes = await request(app)
      .post("/prove")
      .send({
        circuitId: "deletionPolicy",
        input: baseInput({ daysSinceLastTransaction: "100" }, policyCommitment),
      });

    expect(proveRes.status).toBe(200);
    expect(proveRes.body.publicSignals[0]).toBe("0");
  }, 30000);

  it("blocks deletion when consent was not given — valid proof, approved=0", async () => {
    const policyCommitment = await realCommitment();
    const proveRes = await request(app)
      .post("/prove")
      .send({ circuitId: "deletionPolicy", input: baseInput({ consentGiven: "0" }, policyCommitment) });

    expect(proveRes.status).toBe(200);
    expect(proveRes.body.publicSignals[0]).toBe("0");
  }, 30000);

  it("blocks deletion when there's an active dependency — valid proof, approved=0", async () => {
    const policyCommitment = await realCommitment();
    const proveRes = await request(app)
      .post("/prove")
      .send({
        circuitId: "deletionPolicy",
        input: baseInput({ hasActiveDependency: "1" }, policyCommitment),
      });

    expect(proveRes.status).toBe(200);
    expect(proveRes.body.publicSignals[0]).toBe("0");
  }, 30000);

  it("REJECTS at proof-generation time when the agent submits a forged (shorter) retention floor — Attack #7 for this tool", async () => {
    const policyCommitment = await realCommitment();

    const proveRes = await request(app)
      .post("/prove")
      .send({
        circuitId: "deletionPolicy",
        input: baseInput(
          { daysSinceLastTransaction: "100", retentionFloorDays: "10" },
          policyCommitment
        ),
      });

    expect(proveRes.status).toBe(422);
    expect(proveRes.body.error).toMatch(/proof generation failed/);
  }, 30000);
});