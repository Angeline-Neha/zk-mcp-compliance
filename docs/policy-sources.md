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

## Deletion Policy (`deletionPolicy.circom`) — v1

| Field | Threshold | Source |
|---|---|---|
| `consentRequired` | consent must be explicitly given | Internal policy (see below) |
| `retentionFloorDays` | **2555 days (7 years)** | Cited: US business recordkeeping convention (below) |
| `activeDependencyBlocks` | any active dependency blocks deletion | Internal policy (see below) |

### Internal policy (consent / active-dependency)

**ZK-MCP Reference Deletion Policy v1:**
1. Deletion may only proceed if the account holder has **explicitly consented** to deletion (`consentGiven = true`). No deletion without affirmative request/consent.
2. Deletion is blocked if the account has **any active dependency** — an open order, pending dispute, active subscription, or unresolved support ticket (`hasActiveDependency = false` required).
3. Both (1) and (2) are necessary but not sufficient — see the cited retention floor below, which overrides consent.

### Cited source (retention-period floor)

The **7-year (2555-day)** `retentionFloorDays` threshold is grounded in a real, external, checkable convention: U.S. financial recordkeeping guidance consistently recommends retaining financial/transactional business records — ledgers, invoices, expense reports, financial statements — for **at least 7 years**, even though the IRS's standard audit window (period of limitations) is 3 years. The 7-year figure is the widely-cited conservative floor accounting for extended-audit scenarios (understatement of income by 25%+ extends the window to 6 years) and is repeatedly recommended by business/accounting advisory sources as the safe retention baseline.

We use this as the mandatory retention floor: an account's underlying transaction/financial history may not be deleted until **at least 7 years** have passed since the last financial transaction on that account, **regardless of consent** — this is what Section 4 calls "any mandatory retention-period floor that blocks deletion even if requested."

**What's explicitly out of scope:** we are not implementing jurisdiction-specific data-protection law (e.g. GDPR Article 17 erasure-request procedure, CCPA deletion-request timelines) — only the single arithmetic fact of a retention-floor day-count, analogous to how the refund circuit only took the chargeback-window day-count from card-network practice. A real production system would need real legal review per jurisdiction; this is a defensible engineering anchor for a checkable, compilable subset, not a compliance-law implementation.

**References:**
- US Chamber of Commerce (CO—) — business tax/document retention guidance, recommending 7-year retention for financial ledgers/invoices/statements
- Multiple accounting-advisory sources — converging recommendation of 7 years as the safe floor beyond the IRS's 3-year standard audit window, citing the 6-year extended-audit exception (25%+ underreported income) as the driver for the more conservative figure