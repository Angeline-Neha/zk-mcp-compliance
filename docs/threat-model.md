# Threat Model & Red-Team Results

This document describes the attacker capabilities assumed by the system and
the results of red-teaming it against 9 attack classes. All results below
are from actual runs against the live services (via `attack-scripts` and the
demo gateway's Auditor Dashboard), not theoretical claims.

## Trust boundary

The system assumes the LLM agent itself is **not trustworthy** — it may be
prompt-injected, confused, or simply wrong. No privileged MCP tool call
executes on the agent's say-so alone; every call must carry two independent
zero-knowledge proofs (see main README) plus an intent-binding check, all
verified server-side.

## Methodology

Each attack is implemented as a standalone script (`attack-scripts` package)
or an interactive step (`demo-gateway`'s Auditor Dashboard), and is run
against the real, live services over actual HTTP/MCP calls — not mocked or
simulated in-process. A result of "blocked" means the live gate rejected the
call for the documented reason; a result of "passed" would mean the
attacker's action executed. The Auditor Dashboard scoreboard is
intentionally unpersisted and resets on server restart, so it only ever
reflects attacks that were actually run against the current process.

## Results

| # | Attack | Result |
|---|---|---|
| 1 | Replay | ✅ Blocked |
| 2 | Confused deputy | ✅ Blocked |
| 3 | Privilege escalation via delegation | ✅ Blocked |
| 4 | Lateral movement | ✅ Blocked |
| 5 | Cross-server credential reuse | ✅ Blocked |
| 6 | TOCTOU / revocation race | ✅ Blocked |
| 7 | Fake compliance proof | ✅ Blocked |
| 8 | Intent injection | ✅ Blocked (hardest to close — see below) |
| 9 | Salami slicing | ✅ Blocked |

---

## 1. Replay

**Attempt:** Reuse a valid Proof 1 (Sigma/Schnorr) for the same action,
nonce, and server a second time.

**Defense:** Nonces are burned atomically on first use via Redis `GETDEL` —
the second verification attempt fails because the nonce no longer exists to
check against.

## 2. Confused deputy

**Attempt:** An agent holding only an `issue_refund`-scoped attestation
signs a proof claiming `delete_account` scope, and tries to use it against
the admin server.

**Defense:** Scope match is checked against what the attestation was
actually issued for, not what the proof claims — a proof for a scope the
attestation never held fails verification.

## 3. Privilege escalation via delegation

**Attempt:** Agent A legitimately delegates a narrow scope ($50 refund
limit) to Agent B. Agent B then tries to delegate a *much wider* scope
($50,000 limit) to a sub-agent C.

**Defense:** The issuer enforces that delegation can only ever narrow scope,
never widen it — a child's delegated scope must be a subset of the parent's.
Agent B's escalation attempt is rejected at the issuer.

## 4. Lateral movement

**Attempt:** An attacker with no attestation at all — not even a mismatched
one — invokes `delete_account` directly with a fabricated attestation ID.

**Defense:** Attestation existence is checked before scope is even compared.
A nonexistent attestation ID fails the lookup immediately. (Distinct from
#2, where a *real* attestation exists but for the wrong scope.)

## 5. Cross-server credential reuse

**Attempt:** A proof generated as if for `finance-mcp-server` is submitted
against the real, live `admin-mcp-server` instead, hoping the server binding
isn't actually enforced.

**Defense:** `serverId` is baked directly into the Sigma challenge hash
(`H(R, publicKey, scope, nonce, serverId)`). A proof signed for one server
cannot satisfy the verification equation on another — this is enforced by
the underlying algebra, not a server-side lookup, so there's no check to
bypass.

## 6. TOCTOU / revocation race

**Attempt:** An agent's credential is revoked (e.g. simulating a detected
key compromise) *after* a valid proof was generated but *before* it's
submitted — exploiting the gap between proof generation and verification.

**Defense:** Revocation status is re-checked at verification time, not
cached from when the proof was generated. A proof that is still
algebraically valid is rejected anyway because its underlying attestation is
now revoked.

## 7. Fake compliance proof

**Attempt:** Forge a compliance proof against a fake, more lenient policy —
both a fake policy limit *and* a matching fake commitment computed for it,
so the forgery is internally self-consistent.

**Defense:** Two independent layers: (a) the circuit's own Poseidon
commitment check fails witness generation if the claimed commitment doesn't
match a value the circuit can independently derive, and (b) even if an
attacker forges both consistently, the gate separately checks the proof's
public commitment against the *registered* policy commitment on file — a
self-consistent forgery still doesn't match what was actually registered.

## 8. Intent injection (hardest to close)

**Attempt:** Two sub-cases, both exploiting the same underlying gap:

- **Sub-case A** — submit a refund for an order that was never part of any
  authenticated intent commitment, using transaction data that happens to
  pass policy on its own (low amount, clean account history).
- **Sub-case B** — a customer's session legitimately commits to order
  `9102`; injected text tries to also trigger a refund against a *different*
  order (`9101`) from the same customer.

**Why it was hard:** the pre-fix gate checked *whether a proof was valid*,
not *whether the action traced back to what the user actually authorized*.
An injected order with policy-passing data was cryptographically
indistinguishable from a legitimate one — whether it got rejected was
data-dependent luck (e.g. it might coincidentally fail a `pastRefundCount`
threshold), not a guarantee.

**Defense:** Intent binding. Both proofs are now cryptographically tied to a
per-session intent commitment hash covering the specific order refs the
session actually committed to. An action against an order outside that
committed set fails with `INTENT_BINDING_FAIL` *before* the compliance proof
is even evaluated — regardless of whether that order's transaction data
would otherwise have passed policy.

## 9. Salami slicing

**Attempt:** Resubmit the exact same refund against the same order multiple
times, hoping each individual request — which looks perfectly legitimate in
isolation — slips through one at a time.

**Defense:** Reuses the intent-binding mechanism from #8 rather than relying
solely on the compliance circuit's separate `pastRefundCount < 3` backstop
(which is still real and still enforced, just not the primary guard here).
The intent commitment's `expectedActionCount` authorizes exactly one action
against a given commitment — the first identical request passes, and any
repeat is blocked immediately, regardless of whether the transaction data
would still independently satisfy policy.

---

## Reproducing these results

```bash
# with all services running (see main README's Setup section)
pnpm --filter attack-scripts test
# or interactively via the frontend's Auditor Dashboard → Attack Control Panel
```