import { AttackResult, getNonce, verifyProof1 } from "../common";
import { generateKeyPair, generateProof } from "@zk-mcp/sigma-core";
import { randomUUID } from "crypto";

/**
 * Attack #4 — Lateral movement. An attacker with NO credential for
 * delete_account at all (no attestation exists, not even a mismatched
 * one) tries to invoke it directly. Distinct from #2 (confused deputy),
 * where a REAL attestation exists but for the wrong scope — here nothing
 * was ever issued for this identity at all. What should block it:
 * attestation existence check fails immediately (getAttestation returns
 * null before scope is even compared).
 */
export async function attack4_lateralMovement(): Promise<AttackResult> {
  const { secretKey, publicKey } = generateKeyPair();
  const nonce = await getNonce("delete_account", "admin-mcp-server");
  const proof = generateProof(secretKey, publicKey, {
    scope: "delete_account",
    nonce,
    serverId: "admin-mcp-server",
  });

  // ATTACK: a completely fabricated attestationId — nothing was EVER
  // registered for this identity, let alone for delete_account
  const fakeAttestationId = randomUUID();

  const result = await verifyProof1({
    attestationId: fakeAttestationId,
    proof,
    nonce,
    serverId: "admin-mcp-server",
    requestedScope: { action: "delete_account" },
  });

  return {
    attack: "4: Lateral movement",
    blocked: result.valid === false,
    reason: result.valid
      ? "VULNERABLE: a nonexistent attestation was accepted"
      : `blocked correctly: ${result.reason}`,
  };
}