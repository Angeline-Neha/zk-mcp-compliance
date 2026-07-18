import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { buildPoseidon } from "circomlibjs";

const POLICY = {
  policyLimit: 150,
  minAccountAgeDays: 30,
  maxPastRefundCount: 3,
  maxTransactionAgeDays: 120,
  policyLimitSalt: "48972134501928471234509182734",
};
const AMOUNT_SALT = "9182736450918273645091827364";

async function realCommitment(): Promise<string> {
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

async function amountCommitment(amount: number, salt: string): Promise<string> {
  const poseidon = await buildPoseidon();
  const hash = poseidon([amount, salt]);
  return poseidon.F.toObject(hash).toString();
}

function baseInput(overrides: Record<string, string>, policyCommitment: string) {
  return {
    amount: "100",
    accountAgeDays: "45",
    pastRefundCount: "1",
    transactionAgeDays: "10",
    amountSalt: AMOUNT_SALT,
    policyLimit: POLICY.policyLimit.toString(),
    minAccountAgeDays: POLICY.minAccountAgeDays.toString(),
    maxPastRefundCount: POLICY.maxPastRefundCount.toString(),
    maxTransactionAgeDays: POLICY.maxTransactionAgeDays.toString(),
    policyLimitSalt: POLICY.policyLimitSalt,
    policyCommitment,
    ...overrides,
  };
}

describe("POST /prove + POST /verify — real Groth16 round trip", () => {
  it("generates a real proof for a compliant refund and it verifies true", async () => {
    const policyCommitment = await realCommitment();

    const proveRes = await request(app)
      .post("/prove")
      .send({ circuitId: "refundPolicy", input: baseInput({}, policyCommitment) });

    expect(proveRes.status).toBe(200);
    expect(proveRes.body.proof).toBeDefined();
    expect(proveRes.body.publicSignals).toBeDefined();
    // signal order: [approved, amountCommitment, policyCommitment]
    expect(proveRes.body.publicSignals[0]).toBe("1");

    const verifyRes = await request(app).post("/verify").send({
      circuitId: "refundPolicy",
      proof: proveRes.body.proof,
      publicSignals: proveRes.body.publicSignals,
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
  }, 30000);

  it("amountCommitment in publicSignals matches an independently recomputed Poseidon(amount, salt) — this is what the gate checks to bind proven amount to executed amount", async () => {
    const policyCommitment = await realCommitment();

    const proveRes = await request(app)
      .post("/prove")
      .send({ circuitId: "refundPolicy", input: baseInput({ amount: "100" }, policyCommitment) });

    const expectedCommitment = await amountCommitment(100, AMOUNT_SALT);
    expect(proveRes.body.publicSignals[1]).toBe(expectedCommitment);
  }, 30000);

  it("generates a valid proof for a threshold-violating refund, but approved=0 (escalate, not a crash)", async () => {
    const policyCommitment = await realCommitment();

    const proveRes = await request(app)
      .post("/prove")
      .send({
        circuitId: "refundPolicy",
        input: baseInput({ amount: "5000" }, policyCommitment), // over the $150 limit
      });

    expect(proveRes.status).toBe(200);
    expect(proveRes.body.publicSignals[0]).toBe("0"); // approved = false

    const verifyRes = await request(app).post("/verify").send({
      circuitId: "refundPolicy",
      proof: proveRes.body.proof,
      publicSignals: proveRes.body.publicSignals,
    });
    // the PROOF is still cryptographically valid — it correctly proves
    // "I evaluated the real policy and got APPROVE=false"
    expect(verifyRes.body.valid).toBe(true);
  }, 30000);

  it("REJECTS at proof-generation time when the agent submits forged (more lenient) policy params while claiming the real commitment — Attack #7", async () => {
    const policyCommitment = await realCommitment(); // the REAL, registered commitment

    const proveRes = await request(app)
      .post("/prove")
      .send({
        circuitId: "refundPolicy",
        input: baseInput(
          {
            amount: "5000", // would only pass under a forged, more lenient policy
            policyLimit: "999999", // FORGED — nowhere near the real 150
          },
          policyCommitment // still claims the REAL commitment publicly
        ),
      });

    // Cannot even generate a witness — this is a hard cryptographic
    // failure (Poseidon commitment mismatch), not a soft application check.
    expect(proveRes.status).toBe(422);
    expect(proveRes.body.error).toMatch(/proof generation failed/);
  }, 30000);

  it("REJECTS verification of a proof whose publicSignals were tampered with after generation", async () => {
    const policyCommitment = await realCommitment();

    const proveRes = await request(app)
      .post("/prove")
      .send({ circuitId: "refundPolicy", input: baseInput({}, policyCommitment) });

    // tamper: corrupt the committed policy hash (last signal)
    const tamperedSignals = [...proveRes.body.publicSignals];
    tamperedSignals[2] = "1";

    const verifyRes = await request(app).post("/verify").send({
      circuitId: "refundPolicy",
      proof: proveRes.body.proof,
      publicSignals: tamperedSignals,
    });

    expect(verifyRes.body.valid).toBe(false);
  }, 30000);

  it("404s for an unknown circuit id", async () => {
    const res = await request(app)
      .post("/prove")
      .send({ circuitId: "nonexistentPolicy", input: {} });
    expect(res.status).toBe(404);
  });
});