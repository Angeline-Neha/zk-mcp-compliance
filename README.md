<div align="center">
  <img src="./docs/banner-v2.svg" width="100%" alt="ZK-MCP-Auth-Compliance" />
</div>
# zk-mcp-compliance

A zero-knowledge proof based authorization and compliance system for LLM agents calling MCP (Model Context Protocol) tools. Agents prove **who they are**, **what they're authorized to do**, and **that a proposed action satisfies a compliance policy** — all without ever revealing the underlying transaction data, policy thresholds, or reasoning trace to the verifier.

Every LLM-driven agent action against a privileged MCP tool must pass two independent zero-knowledge proofs before it executes:

- **Proof 1 — Authorization** — a non-interactive Sigma/Schnorr proof (Fiat-Shamir over secp256k1) that the calling agent holds a valid, unrevoked, correctly-scoped attestation for this exact action, nonce, and server.
- **Proof 2 — Compliance** — a Groth16 zk-SNARK (Circom) proving the action satisfies a registered policy (spending limit, account age, refund count, transaction age) without revealing the real transaction values or policy thresholds.

Both proofs are bound to a cryptographic intent commitment, closing the gap where an authenticated agent could act on an intent the user never actually authorized.

## Why

Traditional LLM agent systems trust the agent's own tool call — an API key or session token proves *who* is calling, but nothing cryptographically proves the call satisfies policy, or that it matches what the user actually asked for. An LLM that's been prompt-injected, confused, or simply wrong can still pass every conventional check. This project replaces implicit trust in agent behavior with proofs the server can verify independently, without needing to trust the LLM's judgment at all.

## Architecture

```
Agent (LLM tool-calling loop)
   │
   ├─ 1. Register / delegate identity ──────► issuer-service
   ├─ 2. Request nonce ──────────────────────► issuer-service
   ├─ 3. Generate Proof 1 (Sigma/Schnorr) ───► sigma-core
   ├─ 4. Generate Proof 2 (Groth16) ─────────► compliance-proving-service
   └─ 5. Call MCP tool with both proofs ─────► finance-mcp-server / admin-mcp-server
                                                   │
                                                   ├─ verify Proof 1 (issuer-service)
                                                   ├─ verify Proof 2 (compliance-proving-service)
                                                   ├─ verify intent binding
                                                   ├─ execute tool (real DB mutation)
                                                   └─ write audit log (issuer-service)
```

## Packages

| Package | Role |
|---|---|
| `sigma-core` | Sigma/Schnorr proof generation and verification (secp256k1, SHA-256, Fiat-Shamir) |
| `compliance-circuits` | Circom circuits for policy compliance (Groth16, Poseidon commitments) |
| `compliance-proving-service` | Generates and verifies Groth16 proofs against the circuits |
| `issuer-service` | Identity registration, delegation, revocation, nonce issuance, audit log, intent commitments |
| `finance-mcp-server` | MCP tool server for `issue_refund` — gates execution behind both proofs |
| `admin-mcp-server` | MCP tool server for `delete_account` — used to test cross-server credential reuse |
| `orchestrator-agent` | LLM agent that decides whether a privileged tool call is needed |
| `support-agent` | LLM agent handling customer support tickets, generates proofs, calls MCP tools |
| `admin-agent` | LLM agent for administrative actions |
| `baseline-agent` | Traditional (non-ZK) comparison agent — same policy, same LLM, no cryptographic proofs |
| `red-team-agent` | LLM-driven, Groq-powered attack agent — genuine tool-calling loop, not scripted |
| `attack-scripts` | Scripted attack implementations used by the demo gateway and tests |
| `demo-gateway` | Backend for the frontend demo — task orchestration, SSE event stream, attack control, live DB inspector |
| `frontend` | React/Vite/Tailwind demo UI — Intake, Case Board, Auditor Dashboard, Baseline comparison |

## Attack model

The system is evaluated against 9 attack classes via the red-team agent: replay, confused deputy, privilege escalation via delegation, lateral movement, cross-server credential reuse, TOCTOU/revocation race, fake compliance proof, salami slicing, and intent injection. Results and methodology are in [`docs/threat-model.md`](docs/threat-model.md).

## Prerequisites

- Node.js 18+, pnpm
- Docker + Docker Compose
- A [Groq API key](https://console.groq.com) for the LLM-driven agents

## Setup

```bash
git clone https://github.com/Angeline-Neha/zk-mcp-compliance.git
cd zk-mcp-compliance
pnpm install

# start Postgres + Redis
docker-compose up -d

# run migrations (each service migrates its own schema)
psql $DATABASE_URL -f packages/issuer-service/migrations/001_init.sql
psql $DATABASE_URL -f packages/issuer-service/migrations/002_audit_extension.sql
psql $DATABASE_URL -f packages/issuer-service/migrations/002_intent_commitments.sql
pnpm --filter finance-mcp-server migrate
pnpm --filter admin-mcp-server migrate
pnpm --filter baseline-agent migrate

# seed demo data (customers, orders, policy commitments)
pnpm reseed
```

Create a `.env` in the repo root (or per-package, as needed):

```
DATABASE_URL=postgresql://zkmcp:zkmcp@localhost:5432/zkmcp
GROQ_API_KEY=your_key_here
```

## Running the services

Each service runs on its own port:

| Service | Port |
|---|---|
| issuer-service | 4001 |
| compliance-proving-service | 4002 |
| finance-mcp-server | 4003 |
| support-agent | 4004 |
| admin-mcp-server | 4005 |
| demo-gateway | 4006 |
| baseline-agent | 4008 |

Start everything in dev mode:

```bash
pnpm --filter issuer-service dev
pnpm --filter compliance-proving-service dev
pnpm --filter finance-mcp-server dev
pnpm --filter admin-mcp-server dev
pnpm --filter support-agent dev
pnpm --filter demo-gateway dev
pnpm --filter baseline-agent dev
pnpm --filter frontend dev
```

Then open the frontend dev server URL to access the Case Board, Intake flow, Auditor Dashboard, and Baseline comparison view.

## Testing

```bash
pnpm -r test
```

## Building

```bash
pnpm -r build
```

