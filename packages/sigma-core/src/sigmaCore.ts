/**
 * sigma-core — Phase 1
 *
 * Non-interactive Schnorr proof of knowledge of discrete log, made
 * non-interactive via Fiat-Shamir, bound to (scope, nonce, serverId)
 * so a proof cannot be replayed or reused in a different context.
 *
 * Curve: secp256k1
 * Hash (Fiat-Shamir, out-of-circuit): SHA-256
 *
 * This module has ZERO dependencies on network, DB, or any other
 * package in this workspace. It must be correct in total isolation —
 * every later layer (issuer-service, the MCP gate, etc.) trusts it blindly.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from "@noble/hashes/utils";

const CURVE_ORDER = secp256k1.CURVE.n;

export interface KeyPair {
  /** hex-encoded secret scalar — NEVER leaves the agent, never logged, never sent over the network */
  secretKey: string;
  /** hex-encoded compressed public point P = secretKey * G — safe to share, this is what gets registered with the Issuer */
  publicKey: string;
}

export interface SigmaContext {
  scope: string;
  nonce: string;
  serverId: string;
  /**
   * Optional: SHA-256 hex of the authenticated intent commitment for this
   * session (e.g. H(customerId, orderRefs, nonce, timestamp)). When present,
   * it is included in the Fiat-Shamir challenge preimage, making a proof
   * generated for one authenticated intent structurally incapable of
   * authorising a different action. Omitting this field leaves the challenge
   * identical to the pre-Attack-8 behaviour — all existing callers are
   * backward-compatible.
   */
  intentCommitmentHash?: string;
}

export interface SigmaProof {
  /** hex-encoded compressed commitment point R = k * G */
  R: string;
  /** hex-encoded scalar s = k + c*secretKey mod n */
  s: string;
}

/** Generate a fresh keypair. secretKey is a uniformly random scalar mod curve order n. */
export function generateKeyPair(): KeyPair {
  const secretKeyBytes = secp256k1.utils.randomPrivateKey();
  const publicPoint = secp256k1.ProjectivePoint.BASE.multiply(
    bytesToNumberBE(secretKeyBytes)
  );
  return {
    secretKey: bytesToHex(secretKeyBytes),
    publicKey: publicPoint.toHex(true), // compressed
  };
}

function bytesToNumberBE(bytes: Uint8Array): bigint {
  return BigInt("0x" + bytesToHex(bytes));
}

function mod(a: bigint, m: bigint = CURVE_ORDER): bigint {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

/**
 * Fiat-Shamir challenge:
 *   c = H(R, publicKey, scope, nonce, serverId[, intentCommitmentHash]) mod n
 *
 * Binding serverId (and nonce, and scope) into the challenge is what makes
 * this proof non-replayable and non-transferable across servers/tools/contexts.
 * This is not optional context — omitting any one of these fields reopens
 * a corresponding attack (see Section 7 of the spec: #1 replay, #2 confused
 * deputy, #5 cross-server reuse).
 *
 * When ctx.intentCommitmentHash is provided (Attack 8 / intent-binding
 * extension), it is appended to the preimage AFTER serverId. This makes a
 * proof generated for one authenticated customer request (e.g. orderRef 9102)
 * structurally incapable of authorising a different action (e.g. 9101) —
 * not "rejected by a list check" but "the algebra doesn't balance."
 * Callers that omit this field get the identical challenge as before.
 */
export function computeChallenge(
  R: string,
  publicKey: string,
  ctx: SigmaContext
): bigint {
  const parts: Uint8Array[] = [
    hexToBytes(R),
    hexToBytes(publicKey),
    utf8ToBytes(ctx.scope),
    utf8ToBytes(ctx.nonce),
    utf8ToBytes(ctx.serverId),
  ];
  if (ctx.intentCommitmentHash) {
    parts.push(hexToBytes(ctx.intentCommitmentHash));
  }
  const digest = sha256(concatBytes(...parts));
  return mod(bytesToNumberBE(digest));
}

/**
 * Prover side. Given the agent's keypair and the (scope, nonce, serverId)
 * context it's proving for right now, produce {R, s}.
 */
export function generateProof(
  secretKeyHex: string,
  publicKeyHex: string,
  ctx: SigmaContext
): SigmaProof {
  const secretKey = mod(BigInt("0x" + secretKeyHex));

  // 1. random blinding scalar k
  let k: bigint;
  let R: InstanceType<typeof secp256k1.ProjectivePoint>;
  do {
    const kBytes = secp256k1.utils.randomPrivateKey();
    k = mod(bytesToNumberBE(kBytes));
    R = secp256k1.ProjectivePoint.BASE.multiply(k);
  } while (k === 0n);

  const RHex = R.toHex(true);

  // 2. Fiat-Shamir challenge, bound to publicKey + full context
  const c = computeChallenge(RHex, publicKeyHex, ctx);

  // 3. s = k + c*secretKey mod n
  const s = mod(k + mod(c * secretKey));

  return {
    R: RHex,
    s: s.toString(16).padStart(64, "0"),
  };
}

/**
 * Verifier side. Recomputes the challenge and checks s*G == R + c*P.
 *
 * NOTE: this function performs ONLY the algebraic check. It deliberately
 * does not touch nonce state, revocation lists, or scope registries —
 * those are stateful concerns that belong to issuer-service (Phase 2),
 * since sigma-core has zero dependencies by design. The full verification
 * checklist from spec Section 2 (nonce burn, scope match, expiry,
 * revocation, delegation-chain narrowing) is composed on top of this.
 */
export function verifyProof(
  proof: SigmaProof,
  publicKeyHex: string,
  ctx: SigmaContext
): boolean {
  try {
    const P = secp256k1.ProjectivePoint.fromHex(publicKeyHex);
    const R = secp256k1.ProjectivePoint.fromHex(proof.R);
    const s = mod(BigInt("0x" + proof.s));

    const c = computeChallenge(proof.R, publicKeyHex, ctx);

    const lhs = secp256k1.ProjectivePoint.BASE.multiply(s);
    const rhs = R.add(P.multiply(c));

    return lhs.equals(rhs);
  } catch {
    // malformed point encoding, out-of-range scalar, etc. -> not a valid proof
    return false;
  }
}
