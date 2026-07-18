import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { pool } from "../src/db";
import { redis } from "../src/redis";
import { generateKeyPair, generateProof } from "@zk-mcp/sigma-core";
import { isSubsetScope } from "../src/attestations";

afterAll(async () => {
  await pool.end();
  redis.disconnect();
});

describe("isSubsetScope (pure function, no I/O)", () => {
  it("accepts identical scope", () => {
    expect(isSubsetScope({ action: "issue_refund", limit: 100 }, { action: "issue_refund", limit: 100 })).toBe(true);
  });
  it("accepts a strictly narrower limit", () => {
    expect(isSubsetScope({ action: "issue_refund", limit: 50 }, { action: "issue_refund", limit: 100 })).toBe(true);
  });
  it("rejects a wider limit", () => {
    expect(isSubsetScope({ action: "issue_refund", limit: 500 }, { action: "issue_refund", limit: 100 })).toBe(false);
  });
  it("rejects a different action entirely", () => {
    expect(isSubsetScope({ action: "delete_account", limit: 10 }, { action: "issue_refund", limit: 100 })).toBe(false);
  });
  it("rejects a child with no limit when parent has one (unbounded widening)", () => {
    expect(isSubsetScope({ action: "issue_refund" }, { action: "issue_refund", limit: 100 })).toBe(false);
  });
});

describe("POST /register", () => {
  it("registers a new attestation and persists it to Postgres", async () => {
    const { publicKey } = generateKeyPair();
    const res = await request(app).post("/register").send({
      agentId: "orchestrator-agent",
      publicKey,
      scope: { action: "issue_refund", limit: 1000 },
      expirySeconds: 3600,
    });
    expect(res.status).toBe(201);
    expect(res.body.attestation.id).toBeTypeOf("string");
    expect(res.body.attestation.scope).toEqual({ action: "issue_refund", limit: 1000 });
  });
});

describe("POST /delegate — Attack #3 (privilege escalation) validated in isolation", () => {
  it("allows delegation to a narrower scope", async () => {
    const parentKeys = generateKeyPair();
    const parentRes = await request(app).post("/register").send({
      agentId: "orchestrator-agent",
      publicKey: parentKeys.publicKey,
      scope: { action: "issue_refund", limit: 1000 },
      expirySeconds: 3600,
    });
    const parentId = parentRes.body.attestation.id;

    const childKeys = generateKeyPair();
    const delegateRes = await request(app).post("/delegate").send({
      parentAttestationId: parentId,
      childAgentId: "support-agent",
      childPublicKey: childKeys.publicKey,
      requestedScope: { action: "issue_refund", limit: 200 },
      expirySeconds: 3600,
    });

    expect(delegateRes.status).toBe(201);
    expect(delegateRes.body.attestation.scope.limit).toBe(200);
    expect(delegateRes.body.attestation.parentAttestationId).toBe(parentId);
  });

  it("REJECTS a delegation request for a wider scope than the parent holds — the core test the roadmap calls out", async () => {
    const parentKeys = generateKeyPair();
    const parentRes = await request(app).post("/register").send({
      agentId: "orchestrator-agent",
      publicKey: parentKeys.publicKey,
      scope: { action: "issue_refund", limit: 100 }, // parent holds only up to 100
      expirySeconds: 3600,
    });
    const parentId = parentRes.body.attestation.id;

    const childKeys = generateKeyPair();
    const delegateRes = await request(app).post("/delegate").send({
      parentAttestationId: parentId,
      childAgentId: "support-agent",
      childPublicKey: childKeys.publicKey,
      requestedScope: { action: "issue_refund", limit: 5000 }, // requests WAY more than parent holds
      expirySeconds: 3600,
    });

    expect(delegateRes.status).toBe(403);
    expect(delegateRes.body.error).toBe("delegation rejected");
    expect(delegateRes.body.reason).toMatch(/not a subset/);
  });

  it("REJECTS delegation to a different action than the parent holds (cannot delegate refund-scope into delete-scope)", async () => {
    const parentKeys = generateKeyPair();
    const parentRes = await request(app).post("/register").send({
      agentId: "orchestrator-agent",
      publicKey: parentKeys.publicKey,
      scope: { action: "issue_refund", limit: 100 },
      expirySeconds: 3600,
    });
    const parentId = parentRes.body.attestation.id;

    const childKeys = generateKeyPair();
    const delegateRes = await request(app).post("/delegate").send({
      parentAttestationId: parentId,
      childAgentId: "admin-agent",
      childPublicKey: childKeys.publicKey,
      requestedScope: { action: "delete_account", limit: 1 },
      expirySeconds: 3600,
    });

    expect(delegateRes.status).toBe(403);
  });

  it("REJECTS delegation from a nonexistent parent attestation", async () => {
    const childKeys = generateKeyPair();
    const res = await request(app).post("/delegate").send({
      parentAttestationId: "00000000-0000-0000-0000-000000000000",
      childAgentId: "support-agent",
      childPublicKey: childKeys.publicKey,
      requestedScope: { action: "issue_refund", limit: 10 },
      expirySeconds: 3600,
    });
    expect(res.status).toBe(403);
    expect(res.body.reason).toMatch(/does not exist/);
  });
});

describe("POST /verify — full Proof 1 checklist (Section 2, step 3)", () => {
  it("passes for a genuinely valid proof against a fresh nonce", async () => {
    const { secretKey, publicKey } = generateKeyPair();
    const regRes = await request(app).post("/register").send({
      agentId: "support-agent",
      publicKey,
      scope: { action: "issue_refund", limit: 500 },
      expirySeconds: 3600,
    });
    const attestationId = regRes.body.attestation.id;

    const challengeRes = await request(app)
      .post("/challenge")
      .send({ scope: "issue_refund", serverId: "finance-mcp-server" });
    const { nonce } = challengeRes.body;

    const proof = generateProof(secretKey, publicKey, {
      scope: "issue_refund",
      nonce,
      serverId: "finance-mcp-server",
    });

    const verifyRes = await request(app).post("/verify").send({
      attestationId,
      proof,
      nonce,
      serverId: "finance-mcp-server",
      requestedScope: { action: "issue_refund", limit: 500 },
    });

    expect(verifyRes.body).toEqual({ valid: true });
  });

  it("REJECTS replay — the same proof+nonce submitted twice (Attack #1)", async () => {
    const { secretKey, publicKey } = generateKeyPair();
    const regRes = await request(app).post("/register").send({
      agentId: "support-agent",
      publicKey,
      scope: { action: "issue_refund", limit: 500 },
      expirySeconds: 3600,
    });
    const attestationId = regRes.body.attestation.id;

    const challengeRes = await request(app)
      .post("/challenge")
      .send({ scope: "issue_refund", serverId: "finance-mcp-server" });
    const { nonce } = challengeRes.body;

    const proof = generateProof(secretKey, publicKey, {
      scope: "issue_refund",
      nonce,
      serverId: "finance-mcp-server",
    });

    const body = {
      attestationId,
      proof,
      nonce,
      serverId: "finance-mcp-server",
      requestedScope: { action: "issue_refund", limit: 500 },
    };

    const first = await request(app).post("/verify").send(body);
    expect(first.body.valid).toBe(true);

    const second = await request(app).post("/verify").send(body);
    expect(second.body.valid).toBe(false);
    expect(second.body.reason).toMatch(/nonce/);
  });

  it("REJECTS a proof for an attestation that was revoked, even though the proof itself is algebraically valid (Attack #6 - TOCTOU)", async () => {
    const { secretKey, publicKey } = generateKeyPair();
    const regRes = await request(app).post("/register").send({
      agentId: "support-agent",
      publicKey,
      scope: { action: "issue_refund", limit: 500 },
      expirySeconds: 3600,
    });
    const attestationId = regRes.body.attestation.id;

    await request(app).post("/revoke").send({ attestationId, reason: "compromised key" });

    const challengeRes = await request(app)
      .post("/challenge")
      .send({ scope: "issue_refund", serverId: "finance-mcp-server" });
    const { nonce } = challengeRes.body;

    const proof = generateProof(secretKey, publicKey, {
      scope: "issue_refund",
      nonce,
      serverId: "finance-mcp-server",
    });

    const verifyRes = await request(app).post("/verify").send({
      attestationId,
      proof,
      nonce,
      serverId: "finance-mcp-server",
      requestedScope: { action: "issue_refund", limit: 500 },
    });

    expect(verifyRes.body.valid).toBe(false);
    expect(verifyRes.body.reason).toMatch(/revoked/);
  });

  it("REJECTS a proof requesting a scope wider than the attestation actually holds (Attack #2/#4)", async () => {
    const { secretKey, publicKey } = generateKeyPair();
    const regRes = await request(app).post("/register").send({
      agentId: "support-agent",
      publicKey,
      scope: { action: "issue_refund", limit: 100 },
      expirySeconds: 3600,
    });
    const attestationId = regRes.body.attestation.id;

    const challengeRes = await request(app)
      .post("/challenge")
      .send({ scope: "issue_refund", serverId: "finance-mcp-server" });
    const { nonce } = challengeRes.body;

    const proof = generateProof(secretKey, publicKey, {
      scope: "issue_refund",
      nonce,
      serverId: "finance-mcp-server",
    });

    const verifyRes = await request(app).post("/verify").send({
      attestationId,
      proof,
      nonce,
      serverId: "finance-mcp-server",
      requestedScope: { action: "issue_refund", limit: 99999 }, // way beyond held limit
    });

    expect(verifyRes.body.valid).toBe(false);
    expect(verifyRes.body.reason).toBe("scope mismatch");
  });

  it("REJECTS a proof generated for a different serverId (Attack #5 - cross-server reuse)", async () => {
    const { secretKey, publicKey } = generateKeyPair();
    const regRes = await request(app).post("/register").send({
      agentId: "support-agent",
      publicKey,
      scope: { action: "issue_refund", limit: 500 },
      expirySeconds: 3600,
    });
    const attestationId = regRes.body.attestation.id;

    // nonce issued for finance-mcp-server
    const challengeRes = await request(app)
      .post("/challenge")
      .send({ scope: "issue_refund", serverId: "finance-mcp-server" });
    const { nonce } = challengeRes.body;

    // proof generated for a DIFFERENT server (attacker hoping admin-mcp-server won't scope-check it)
    const proof = generateProof(secretKey, publicKey, {
      scope: "issue_refund",
      nonce,
      serverId: "admin-mcp-server",
    });

    const verifyRes = await request(app).post("/verify").send({
      attestationId,
      proof,
      nonce,
      serverId: "admin-mcp-server", // verifying against admin server, but nonce was never issued there
      requestedScope: { action: "issue_refund", limit: 500 },
    });

    expect(verifyRes.body.valid).toBe(false);
    expect(verifyRes.body.reason).toMatch(/nonce/);
  });
});

describe("delegation chain narrowing, end to end through /verify", () => {
  it("a delegated child's proof verifies correctly through the full chain check", async () => {
    const parentKeys = generateKeyPair();
    const parentRes = await request(app).post("/register").send({
      agentId: "orchestrator-agent",
      publicKey: parentKeys.publicKey,
      scope: { action: "issue_refund", limit: 1000 },
      expirySeconds: 3600,
    });
    const parentId = parentRes.body.attestation.id;

    const childKeys = generateKeyPair();
    const delegateRes = await request(app).post("/delegate").send({
      parentAttestationId: parentId,
      childAgentId: "support-agent",
      childPublicKey: childKeys.publicKey,
      requestedScope: { action: "issue_refund", limit: 200 },
      expirySeconds: 3600,
    });
    const childId = delegateRes.body.attestation.id;

    const challengeRes = await request(app)
      .post("/challenge")
      .send({ scope: "issue_refund", serverId: "finance-mcp-server" });
    const { nonce } = challengeRes.body;

    const proof = generateProof(childKeys.secretKey, childKeys.publicKey, {
      scope: "issue_refund",
      nonce,
      serverId: "finance-mcp-server",
    });

    const verifyRes = await request(app).post("/verify").send({
      attestationId: childId,
      proof,
      nonce,
      serverId: "finance-mcp-server",
      requestedScope: { action: "issue_refund", limit: 200 },
    });

    expect(verifyRes.body.valid).toBe(true);
  });
});

describe("POST /audit — unified two-proof audit entry", () => {
  it("accepts and persists a passing audit entry", async () => {
    const res = await request(app).post("/audit").send({
      agentId: "support-agent",
      scopeAction: "issue_refund",
      toolName: "issue_refund",
      proof1Hash: "abc123",
      proof2Hash: "def456",
      pass: true,
      policyCommitment: "0xdeadbeef",
    });
    expect(res.status).toBe(201);
    expect(res.body.logged).toBe(true);
  });

  it("accepts and persists a failing audit entry with a reason", async () => {
    const res = await request(app).post("/audit").send({
      agentId: "support-agent",
      scopeAction: "issue_refund",
      toolName: "issue_refund",
      proof1Hash: "abc123",
      proof2Hash: null,
      pass: false,
      reason: "compliance proof generation failed",
    });
    expect(res.status).toBe(201);
  });
});

describe("POST /policy-commitment + GET /policy-commitment/:toolScope", () => {
  it("registers and retrieves a policy commitment for a tool scope", async () => {
    const post = await request(app)
      .post("/policy-commitment")
      .send({ toolScope: "issue_refund_test", commitmentHex: "0xabc123" });
    expect(post.status).toBe(201);

    const get = await request(app).get("/policy-commitment/issue_refund_test");
    expect(get.status).toBe(200);
    expect(get.body.commitmentHex).toBe("0xabc123");
  });

  it("upserts — re-registering the same tool scope updates the commitment", async () => {
    await request(app)
      .post("/policy-commitment")
      .send({ toolScope: "delete_account_test", commitmentHex: "0xold" });
    await request(app)
      .post("/policy-commitment")
      .send({ toolScope: "delete_account_test", commitmentHex: "0xnew" });

    const get = await request(app).get("/policy-commitment/delete_account_test");
    expect(get.body.commitmentHex).toBe("0xnew");
  });

  it("404s for an unregistered tool scope", async () => {
    const res = await request(app).get("/policy-commitment/nonexistent_tool_xyz");
    expect(res.status).toBe(404);
  });
});