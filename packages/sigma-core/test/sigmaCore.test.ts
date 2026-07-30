import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  generateProof,
  verifyProof,
  type SigmaContext,
} from "../src/sigmaCore";

const ctx: SigmaContext = {
  scope: "issue_refund",
  nonce: "nonce-abc-123",
  serverId: "finance-mcp-server",
};

describe("sigma-core: Schnorr / Fiat-Shamir proof of knowledge", () => {
  it("a correctly generated proof verifies", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof = generateProof(secretKey, publicKey, ctx);
    expect(verifyProof(proof, publicKey, ctx)).toBe(true);
  });

  it("rejects a proof with a tampered R", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof = generateProof(secretKey, publicKey, ctx);

    // swap in an unrelated, unrelated-to-k commitment point
    const { publicKey: unrelatedPoint } = generateKeyPair();
    const tampered = { ...proof, R: unrelatedPoint };

    expect(verifyProof(tampered, publicKey, ctx)).toBe(false);
  });

  it("rejects a proof with a tampered s", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof = generateProof(secretKey, publicKey, ctx);

    // flip the last hex digit of s
    const lastChar = proof.s.at(-1);
    const flipped = lastChar === "0" ? "1" : "0";
    const tampered = { ...proof, s: proof.s.slice(0, -1) + flipped };

    expect(verifyProof(tampered, publicKey, ctx)).toBe(false);
  });

  it("rejects verification against the wrong serverId (cross-server replay protection)", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof = generateProof(secretKey, publicKey, ctx);

    const differentServerCtx: SigmaContext = {
      ...ctx,
      serverId: "admin-mcp-server", // proof was generated for finance-mcp-server
    };

    expect(verifyProof(proof, publicKey, differentServerCtx)).toBe(false);
  });

  it("rejects verification against the wrong scope (confused-deputy protection)", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof = generateProof(secretKey, publicKey, ctx);

    const differentScopeCtx: SigmaContext = { ...ctx, scope: "delete_account" };

    expect(verifyProof(proof, publicKey, differentScopeCtx)).toBe(false);
  });

  it("rejects verification against the wrong nonce (replay protection)", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof = generateProof(secretKey, publicKey, ctx);

    const differentNonceCtx: SigmaContext = { ...ctx, nonce: "some-other-nonce" };

    expect(verifyProof(proof, publicKey, differentNonceCtx)).toBe(false);
  });

  it("rejects a proof verified against the wrong public key", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof = generateProof(secretKey, publicKey, ctx);

    const { publicKey: wrongPublicKey } = generateKeyPair();

    expect(verifyProof(proof, wrongPublicKey, ctx)).toBe(false);
  });

  it("two proofs for the same context are not identical (random blinding factor k)", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof1 = generateProof(secretKey, publicKey, ctx);
    const proof2 = generateProof(secretKey, publicKey, ctx);

    expect(proof1.R).not.toBe(proof2.R);
    expect(proof1.s).not.toBe(proof2.s);
    // but both independently verify
    expect(verifyProof(proof1, publicKey, ctx)).toBe(true);
    expect(verifyProof(proof2, publicKey, ctx)).toBe(true);
  });

  it("does not leak the secret key in the proof or public key", () => {
    const { secretKey, publicKey } = generateKeyPair();
    const proof = generateProof(secretKey, publicKey, ctx);

    expect(proof.R).not.toContain(secretKey);
    expect(proof.s).not.toBe(secretKey);
    expect(publicKey).not.toBe(secretKey);
  });
});
