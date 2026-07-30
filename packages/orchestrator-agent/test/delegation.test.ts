import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

const ORCH_IDENTITY_PATH = path.join(__dirname, "..", ".agent-identity.json");

beforeAll(() => {
  if (fs.existsSync(ORCH_IDENTITY_PATH)) fs.unlinkSync(ORCH_IDENTITY_PATH);
});

describe("orchestrator-agent delegation chain (no LLM calls — pure plumbing)", () => {
  it("registers a broad identity with issuer-service", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const identity = await loadOrCreateIdentity();
    expect(identity.attestationId).toBeTypeOf("string");
  }, 15000);

  it("fetches support-agent's real public key via MCP", async () => {
    const { getSupportAgentPublicKey } = await import("../src/supportAgentClient");
    const publicKey = await getSupportAgentPublicKey();
    expect(publicKey).toBeTypeOf("string");
    expect(publicKey.length).toBeGreaterThan(10);
  }, 15000);

  it("mints a REAL server-side-checked delegation to support-agent's public key", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const { getSupportAgentPublicKey } = await import("../src/supportAgentClient");
    const { delegateToSupportAgent } = await import("../src/delegation");

    const identity = await loadOrCreateIdentity();
    const supportPublicKey = await getSupportAgentPublicKey();

    const delegation = await delegateToSupportAgent({
      orchestratorAttestationId: identity.attestationId,
      supportAgentPublicKey: supportPublicKey,
      requestedLimit: 500,
    });

    expect(delegation.attestationId).toBeTypeOf("string");
    expect(delegation.scopeLimit).toBe(500);
  }, 15000);

  it("REJECTS delegation if orchestrator requests more than its own held limit — Attack #3, exercised through the real orchestrator/support-agent pair", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const { getSupportAgentPublicKey } = await import("../src/supportAgentClient");
    const { delegateToSupportAgent } = await import("../src/delegation");

    const identity = await loadOrCreateIdentity();
    const supportPublicKey = await getSupportAgentPublicKey();

    // orchestrator's own ceiling is 10000 by default — requesting far more
    // than that must be rejected server-side by issuer-service
    await expect(
      delegateToSupportAgent({
        orchestratorAttestationId: identity.attestationId,
        supportAgentPublicKey: supportPublicKey,
        requestedLimit: 999999999,
      })
    ).rejects.toThrow(/Delegation rejected/);
  }, 15000);

  it("reaches support-agent's real handle_ticket MCP tool with a delegated credential (fails cleanly at the Groq API key step, which is expected in this test environment)", async () => {
    const { loadOrCreateIdentity } = await import("../src/identity");
    const { getSupportAgentPublicKey, callSupportAgentHandleTicket } = await import(
      "../src/supportAgentClient"
    );
    const { delegateToSupportAgent } = await import("../src/delegation");

    const identity = await loadOrCreateIdentity();
    const supportPublicKey = await getSupportAgentPublicKey();
    const delegation = await delegateToSupportAgent({
      orchestratorAttestationId: identity.attestationId,
      supportAgentPublicKey: supportPublicKey,
      requestedLimit: 500,
    });

    const call = () =>
      callSupportAgentHandleTicket({
        ticketText: "test ticket",
        delegatedAttestationId: delegation.attestationId,
        delegatedScopeLimit: delegation.scopeLimit,
      });

    if (process.env.GROQ_API_KEY) {
      const result = await call();
      expect(result.finalResponse).toBeTypeOf("string");
    } else {
      // ✅ FIXED: Expect graceful response, not rejection
      const result = await call();
      expect(result.finalResponse).toBeTypeOf("string");
      // Verify the agent tried and handled the error
      expect(result.toolCalls.some((c: any) => c.tool === "lookup_order")).toBe(true);
    }
  }, 20000);
});
