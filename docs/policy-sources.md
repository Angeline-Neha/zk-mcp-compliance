# Policy Sources — ZK-MCP-Auth-Compliance

Per spec Section 4: every circuit constant must trace back to a real, defined,
citable source — not an invented number. This document is that trace.

## Refund Policy (`refundPolicy.circom`) — v1

| Field | Threshold | Source |
|---|---|---|
| `policyLimit` (auto-approvable amount) | **$150** | Internal policy (see below) |
| `minAccountAgeDays` | **30 days** | Internal policy (see below) |
| `maxPastRefundCount` | **3** (rolling 90-day window) | Internal policy (see below) |
| `maxTransactionAgeDays` | **120 days** | Industry chargeback-dispute norm (cited below) |

### Internal policy (amount / account-age / refund-count)

These three thresholds are a **documented internal policy**, not drawn from
an external regulation — Section 4 explicitly permits this ("a documented
internal policy... is enough, as long as it's not invented on the spot").
They are fixed here, in writing, before circuit implementation begins, and
every later change to these numbers requires a new circuit + trusted setup
(see Section 3's Groth16 tradeoff note).

**ZK-MCP Reference Refund Policy v1:**
1. A refund may be auto-approved without escalation if the amount is
   **≤ $150**.
2. The account must be **≥ 30 days old** at time of request. Newer accounts
   are a common fraud vector (fresh accounts requesting refunds), so they're
   excluded from auto-approval regardless of amount.
3. The account must have **< 3 refunds** in the preceding 90 days. This
   caps auto-approval for repeat-refund abuse patterns.
4. Any refund failing (1), (2), or (3) requires human escalation — it is
   NOT denied outright, just routed out of the auto-approve path. The
   circuit's `approved` output being `0` means "escalate," not "reject."

### Cited source (transaction-age / reporting window)

The **120-day** `maxTransactionAgeDays` threshold is grounded in a real,
external, checkable fact: major card networks converge on a **120-day**
standard window from the transaction date for a cardholder to file a
dispute/chargeback. This figure is consistently reported across independent
payments-industry sources covering Visa, Mastercard, American Express, and
Discover dispute rules (see references below). We use it as the rationale
for our reporting/flagging window: a refund request tied to a transaction
**older than 120 days** falls outside the window networks themselves treat
as the normal dispute period, so it's flagged for mandatory human review
rather than auto-approved, regardless of amount or account age.

**What's explicitly out of scope:** we are not implementing card-network
dispute *procedure* (representment, arbitration, reason codes, per-network
variation in merchant response windows). We take only the single arithmetic
fact — the ~120-day cardholder filing window — as the anchor for our
transaction-age comparator. Everything else about real chargeback process
is out of scope for this circuit.

**References:**
- Chargebacks911 / Merchant Cost Consulting — chargeback time limit surveys
  across Visa, Mastercard, Amex, Discover (120-day standard, with noted
  exceptions up to 540 days for specific fraud/future-delivery reason codes)
- ChargebackHelp — notes a 60-day *legal minimum* right to dispute under
  U.S. consumer protection norms, with 120 days being the common
  network-level extension
- Clear.Sale — confirms 120 days as the general filing standard across all
  four major networks, with network-specific trigger-date variations

*(Full URLs omitted from this internal doc; can be added to the final report's
bibliography — this file is the audit trail for circuit constants, not the
citation format for the paper itself.)*

## Deletion Policy (`deletionPolicy.circom`) — not yet finalized

To be completed before Phase 7. Needs: consent-state grounds, retention-period
floor, active-dependency check. Placeholder — do not implement Phase 7's
circuit against this section until it's filled in with the same rigor as above.