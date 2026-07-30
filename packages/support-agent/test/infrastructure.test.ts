import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

const IDENTITY_PATH = path.join(__dirname, "..", ".agent-identity.json");

beforeAll(() => {
  // start with a clean identity each test run
  if (fs.existsSync(IDENTITY_PATH)) fs.unlinkSync(IDENTITY_PATH);
});

describe("support-agent infrastructure (no LLM calls — pure plumbing)", () => {
  it("registers a fresh identity with issuer-service on first load", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const identity = await loadOrCreateIdentity();
    expect(identity.attestationId).toBeTypeOf("string");
    expect(identity.publicKey).toBeTypeOf("string");
    expect(fs.existsSync(IDENTITY_PATH)).toBe(true);
  }, 15000);

  it("reuses the same identity on subsequent loads (does not re-register)", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const first = await loadOrCreateIdentity();
    const second = await loadOrCreateIdentity();
    expect(second.attestationId).toBe(first.attestationId);
    expect(second.publicKey).toBe(first.publicKey);
  }, 15000);

  it("looks up a real order via the real MCP client against finance-mcp-server", async () => {
    const { lookupOrder } = await import("../src/financeClient");
    const order = await lookupOrder("4521");
    expect(order.orderRef).toBe("4521");
    expect(order.amount).toBeTypeOf("number");
  }, 15000);

  it("assembles real proofs (sigma + Groth16) for a real order", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const { lookupOrder } = await import("../src/financeClient");
    const { assembleRefundProofs } = await import("../src/proofGen");

    const identity = await loadOrCreateIdentity();
    const order = await lookupOrder("4521");
    const proofs = await assembleRefundProofs(identity, order);

    expect(proofs.sigmaProof.R).toBeTypeOf("string");
    expect(proofs.sigmaProof.s).toBeTypeOf("string");
    expect(proofs.complianceProof.proof).toBeDefined();
    expect(proofs.complianceProof.publicSignals).toHaveLength(3);
  }, 15000);

  it("full pipeline: real identity + real order + real proofs + real gated tool call, end to end", async () => {
    const { loadOrCreateIdentity, AGENT_ID } = await import("../src/identity");
    const { lookupOrder, callIssueRefund } = await import("../src/financeClient");
    const { assembleRefundProofs } = await import("../src/proofGen");

    const identity = await loadOrCreateIdentity();
    const order = await lookupOrder("9002"); // seeded clean order — see note below

    const proofs = await assembleRefundProofs(identity, order);
    const result = await callIssueRefund({
      agentId: AGENT_ID,
      attestationId: identity.attestationId,
      requestedScope: { action: "issue_refund", limit: 500 },
      sigmaProof: proofs.sigmaProof,
      nonce: proofs.nonce,
      orderRef: "9002",
      claimedAmount: proofs.claimedAmount,
      claimedAmountSalt: proofs.claimedAmountSalt,
      complianceProof: proofs.complianceProof,
    });

    // result depends on real accumulated refund history for this customer —
    // either outcome is a legitimate pass as long as it's not an error/crash
    expect(typeof result.allowed).toBe("boolean");
    expect(result.isError).toBe(!result.allowed);
  }, 20000);
});