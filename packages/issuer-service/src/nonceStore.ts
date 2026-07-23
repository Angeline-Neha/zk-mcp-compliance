import { randomBytes } from "crypto";
import { redis } from "./redis";

const NONCE_TTL_SECONDS = Number(process.env.NONCE_TTL_SECONDS ?? 60);

function nonceKey(scope: string, serverId: string, nonce: string): string {
  return `nonce:${serverId}:${scope}:${nonce}`;
}

/**
 * Issue a fresh nonce bound to (scope, serverId), with a 60s TTL.
 * Binding scope+serverId into the key itself — not just the value —
 * means a nonce issued for one server/scope can never even be looked
 * up under a different server/scope context.
 */
export async function issueNonce(
  scope: string,
  serverId: string
): Promise<{ nonce: string; expiresAt: number }> {
  const nonce = randomBytes(16).toString("hex");
  const key = nonceKey(scope, serverId, nonce);
  await redis.set(key, "issued", "EX", NONCE_TTL_SECONDS);
  return { nonce, expiresAt: Date.now() + NONCE_TTL_SECONDS * 1000 };
}

/**
 * Atomically check-and-burn a nonce. Uses GETDEL so the check and the
 * burn happen as a single atomic Redis operation — no window where two
 * concurrent requests could both see the nonce as valid (Attack #1: replay).
 *
 * Returns true only if the nonce existed (i.e. was issued, unexpired,
 * and not already burned) for this exact (scope, serverId) pair.
 */
export async function checkAndBurnNonce(
  scope: string,
  serverId: string,
  nonce: string
): Promise<boolean> {
  const key = nonceKey(scope, serverId, nonce);
  const result = await redis.getdel(key);
  return result === "issued";
}
