import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

const IDENTITY_PATH = path.join(__dirname, "..", ".agent-identity.json");

beforeAll(() => {
  if (fs.existsSync(IDENTITY_PATH)) fs.unlinkSync(IDENTITY_PATH);
});

describe("admin-agent infrastructure (no LLM calls — pure plumbing)", () => {
  it("registers a fresh identity with issuer-service on first load", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const identity = await loadOrCreateIdentity();
    expect(identity.attestationId).toBeTypeOf("string");
  }, 15000);

  it("looks up a real account via the real MCP client against admin-mcp-server", async () => {
    const { lookupAccount } = await import("../src/adminClient");
    const account = await lookupAccount("acct-002"); // retention-violation account, still exists
    expect(account.accountRef).toBe("acct-002");
    expect(account.accountIdFieldElement).toBeTypeOf("string");
  }, 15000);

  it("assembles real proofs (sigma + Groth16) for a real account", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const { lookupAccount } = await import("../src/adminClient");
    const { assembleDeletionProofs } = await import("../src/proofGen");

    const identity = await loadOrCreateIdentity();
    const account = await lookupAccount("acct-002");
    const proofs = await assembleDeletionProofs(identity, {
      accountRef: "acct-002",
      consentGiven: account.consentGiven,
      daysSinceLastTransaction: account.daysSinceLastTransaction,
      hasActiveDependency: account.hasActiveDependency,
    });

    expect(proofs.sigmaProof.R).toBeTypeOf("string");
    expect(proofs.complianceProof.publicSignals).toHaveLength(3);
    // acct-002 fails the retention floor, so approved should be "0"
    expect(proofs.complianceProof.publicSignals[0]).toBe("0");
  }, 15000);

  it("full pipeline: real identity + real account + real proofs + real gated tool call — correctly REJECTS deletion for acct-002 (retention floor not passed)", async () => {
    const { loadOrCreateIdentity, AGENT_ID } = await import("../src/identity");
    const { lookupAccount, callDeleteAccount } = await import("../src/adminClient");
    const { assembleDeletionProofs } = await import("../src/proofGen");

    const identity = await loadOrCreateIdentity();
    const account = await lookupAccount("acct-002");

    const proofs = await assembleDeletionProofs(identity, {
      accountRef: "acct-002",
      consentGiven: account.consentGiven,
      daysSinceLastTransaction: account.daysSinceLastTransaction,
      hasActiveDependency: account.hasActiveDependency,
    });

    const result = await callDeleteAccount({
      agentId: AGENT_ID,
      attestationId: identity.attestationId,
      requestedScope: { action: "delete_account" },
      sigmaProof: proofs.sigmaProof,
      nonce: proofs.nonce,
      accountRef: "acct-002",
      claimedAccountIdSalt: proofs.claimedAccountIdSalt,
      complianceProof: proofs.complianceProof,
    });

    expect(result.allowed).toBe(false);
    expect(result.isError).toBe(true);
  }, 20000);
});