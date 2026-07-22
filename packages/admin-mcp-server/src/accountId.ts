import { createHash } from "crypto";

/**
 * Deterministic accountRef -> field element mapping. SHA-256 truncated to
 * 31 bytes (248 bits) is safely under BN128's ~254-bit field size. Both
 * whoever generates the compliance proof (agent/compliance micro-service)
 * and this gate (when independently re-deriving it to check the
 * accountIdCommitment binding) must use this EXACT function, or the
 * commitments will never match even for a genuinely honest proof.
 */
export function accountRefToFieldElement(accountRef: string): string {
  const hash = createHash("sha256").update(accountRef).digest();
  return BigInt("0x" + hash.subarray(0, 31).toString("hex")).toString();
}