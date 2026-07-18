# Benchmark Results — Phase 3 (refundPolicy circuit)

All numbers below are from real runs against the actual compiled circuit and
running `compliance-proving-service` process — not estimated.

## Circuit stats (`refundPolicy.circom`)
- Constraints: **488**
- Wires: 494
- Private inputs: 9
- Public inputs: 1 (`policyCommitment`)
- Public outputs: 1 (`approved`)
- Powers of Tau: 2^12 (small — sufficient for this constraint count, per
  roadmap sizing guidance)

## Timing (warm process, 5-call average, measured inside the running
`compliance-proving-service`, i.e. excluding Node process-startup overhead)

| Operation | Measured | Spec's cited figure |
|---|---|---|
| Proof generation (`groth16.fullProve`) | **~270–290ms** (first call ~549ms — WASM witness-calculator warmup) | ~100–300ms |
| Proof verification (`groth16.verify`) | **~19–33ms** | <10ms |

**Honest note on verification timing:** our measured ~19–33ms is above the
spec's cited <10ms. The gap is almost entirely `fs.readFileSync` +
`JSON.parse` of the verification key on every call in the current
implementation, not the actual elliptic-curve pairing check. A production
version should cache the parsed verification key in memory at service
startup rather than re-reading it per request — flagging this as a known
optimization, not re-benchmarking around it, since the current numbers are
what's actually running.

## Proof size
- `proof.json` (JSON, human-readable, decimal-string field elements): **808 bytes**
- The spec's cited "~192 bytes" refers to the raw serialized Groth16 proof
  (2 compressed G1 points + 1 compressed G2 point on BN128 ≈ 32+32+64 bytes).
  JSON encoding with named fields and decimal strings is not the same
  representation and is expected to be larger — this is not a discrepancy,
  just two different serializations of the same proof.

## Cryptographic rejection tests (not performance, but load-bearing for the
threat model — included here since they were measured in the same run)

| Scenario | Result |
|---|---|
| Valid inputs, policy satisfied | `approved=1`, proof verifies `true` |
| Valid policy, transaction violates threshold (amount over $150) | Proof still generates and verifies `true` — but `approved=0`. Circuit correctly distinguishes "policy honestly evaluated, came back false" from "policy check failed to run." |
| **Forged policy params, real claimed commitment** (Attack #7) | Witness generation fails outright — `Assert Failed` at the Poseidon commitment constraint. **No proof can be produced.** This is a hard cryptographic failure, not an application-level rejection. |
| Tampered `publicSignals` after proof generation | `groth16.verify` returns `false` |

## Trusted setup — explicit limitation statement (per spec Section 3)
This is a **local, dummy ceremony** (single contributor, `head -c 32
/dev/urandom` as entropy) — acceptable for a demo per the spec's own
guidance, but not a production-grade multi-party ceremony. A real deployment
would need a public multi-party Powers of Tau / phase-2 ceremony. Documented
here as a known, stated limitation, not a hidden gap.
