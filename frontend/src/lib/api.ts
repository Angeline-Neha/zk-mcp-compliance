// Base URLs — override via .env if services run on different hosts/ports
import type { InspectorSnapshot } from "./inspectorTypes";

export type { InspectorSnapshot } from "./inspectorTypes";

export const ISSUER_URL = import.meta.env.VITE_ISSUER_URL ?? "http://localhost:4001";
export const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:4006";
export const BASELINE_URL = import.meta.env.VITE_BASELINE_URL ?? "http://localhost:4008";
export const FINANCE_URL = import.meta.env.VITE_FINANCE_URL ?? "http://localhost:4003";
export const PROVING_URL = import.meta.env.VITE_PROVING_URL ?? "http://localhost:4002";
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? "http://localhost:4005";
export const SUPPORT_URL = import.meta.env.VITE_SUPPORT_URL ?? "http://localhost:4004";

export async function fetchInspectorDetail(requestId: string): Promise<InspectorSnapshot> {
  const res = await fetch(`${GATEWAY_URL}/task/inspector/${encodeURIComponent(requestId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Inspector lookup failed (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// issuer-service — audit log, attestations
// ---------------------------------------------------------------------------
export interface AuditEntry {
  id: string;
  agentId: string;
  scopeAction: string;
  toolName: string;
  proof1Hash: string | null;
  proof2Hash: string | null;
  pass: boolean;
  reason: string | null;
  policyCommitment: string | null;
  createdAt: string;
}

export interface FunnelStage {
  name: string;
  count: number;
}

/** Real aggregate counts for the Auditor Dashboard's Verification Funnel — derived from actual audit_log rows. */
export async function fetchVerificationFunnel(): Promise<FunnelStage[]> {
  const res = await fetch(`${ISSUER_URL}/audit-log/funnel`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.stages;
}

export async function fetchAuditLog(limit = 50, before?: string): Promise<AuditEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  const res = await fetch(`${ISSUER_URL}/audit-log?${params}`);
  const body = await res.json();
  return body.entries;
}

export interface Attestation {
  id: string;
  agentId: string;
  publicKey: string;
  scope: { action: string; limit?: number };
  expiry: string;
  parentAttestationId: string | null;
  createdAt: string;
  isRevoked: boolean;
  isExpired: boolean;
}

export async function fetchAttestations(): Promise<Attestation[]> {
  const res = await fetch(`${ISSUER_URL}/attestations`);
  const body = await res.json();
  return body.attestations;
}

// ---------------------------------------------------------------------------
// demo-gateway — tasks, attacks, demo control
// ---------------------------------------------------------------------------
export interface ToolCall {
  tool: string;
  input: unknown;
  result: unknown;
}

export interface TaskResult {
  finalResponse: string;
  toolCalls: ToolCall[];
  // orchestrator-specific, present only on /task responses
  delegations?: { attestationId: string; scopeLimit: number }[];
  supportAgentResults?: unknown[];
}

export async function submitTask(ticketText: string): Promise<TaskResult> {
  const res = await fetch(`${GATEWAY_URL}/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketText }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  const raw = await res.json();
  return {
    ...raw,
    toolCalls: raw.toolCalls ?? (raw.supportAgentResults ?? []).flatMap((r: any) => r.toolCalls ?? []),
  };
}

export async function submitAdminTask(ticketText: string): Promise<TaskResult> {
  const res = await fetch(`${GATEWAY_URL}/admin-task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketText }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  const raw = await res.json();
  return {
    ...raw,
    toolCalls: raw.toolCalls ?? (raw.supportAgentResults ?? []).flatMap((r: any) => r.toolCalls ?? []),
  };
}

/**
 * Attack 8 — Structured intake.
 * The server extracts the orderRef from the text, validates it belongs to
 * this authenticated customer, and commits the intent before the LLM runs.
 * The customerId comes from the session — never from the text field.
 */
export async function submitStructuredTask(args: {
  customerId: string;
  ticketText: string;
  /**
   * Optional — isolates this request into its own intent-binding session
   * instead of the default customerId:orderRef session. Use this for
   * demo/attack buttons that share a customer+order (every seeded customer
   * has exactly one order) so they don't drain each other's action-count
   * budget and get misreported as salami-slicing. Leave unset for real
   * customer-typed tickets — those must keep the plain deterministic
   * session so salami-slicing detection still works across separate
   * genuine messages.
   */
  sessionTag?: string;
}): Promise<TaskResult> {
  const res = await fetch(`${GATEWAY_URL}/task/structured`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  const raw = await res.json();
  return {
    ...raw,
    toolCalls: raw.toolCalls ?? (raw.supportAgentResults ?? []).flatMap((r: any) => r.toolCalls ?? []),
  };
}

export interface Customer {
  id: string;
  name: string;
}

/**
 * BASELINE agent — talks directly to the traditional (non-ZK) comparison
 * agent's own server, not through demo-gateway, since it has no proofs,
 * audit trail, or Board/Docket state to fold into. Same request/response
 * shape as the secure system's TaskResult so the UI can render both
 * identically.
 */
export async function submitBaselineTicket(args: {
  customerId: string;
  ticketText: string;
}): Promise<TaskResult> {
  const res = await fetch(`${BASELINE_URL}/ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch(`${GATEWAY_URL}/task/customers`);
  if (!res.ok) throw new Error("Failed to fetch customers");
  return (await res.json()).customers;
}

export interface AttackOutcome {
  status: "not_run" | "blocked" | "passed";
  lastRunAt: string | null;
  lastReason: string | null;
}

/** Real per-exhibit outcomes from actually-completed runs — backs the Auditor Scoreboard. */
export async function fetchAttackResults(): Promise<Record<string, AttackOutcome>> {
  const res = await fetch(`${GATEWAY_URL}/attack/results`);
  if (!res.ok) return {};
  const body = await res.json();
  return body.outcomes;
}

export async function fetchCustomerOrders(customerId: string): Promise<string[]> {
  const res = await fetch(`${GATEWAY_URL}/task/customers/${customerId}/orders`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.orders.map((o: any) => o.orderRef);
}

export interface OrderOption {
  orderRef: string;
  customerId: string;
  amount: number;
  category: "pass" | "fail";
}

/** All real seeded orders — used to populate exhibit "configure" dropdowns. */
export async function fetchOrders(): Promise<OrderOption[]> {
  const res = await fetch(`${GATEWAY_URL}/task/orders`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.orders;
}

export interface AttackMeta {
  id: string;
  title: string;
}

export const ATTACKS: AttackMeta[] = [
  { id: "1", title: "Replay" },
  { id: "2", title: "Confused Deputy" },
  { id: "3", title: "Privilege Escalation via Delegation" },
  { id: "4", title: "Lateral Movement" },
  { id: "5", title: "Cross-Server Credential Reuse" },
  { id: "6", title: "TOCTOU / Revocation Race" },
  { id: "7", title: "Fake Compliance Proof" },
  { id: "8", title: "Intent Injection" },
];

export interface AttackStartResponse {
  runId: string;
  title: string;
  steps: { index: number; label: string }[];
}

export async function startAttack(attackId: string): Promise<AttackStartResponse> {
  const res = await fetch(`${GATEWAY_URL}/attack/${attackId}/start`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export interface StepResult {
  label: string;
  narration: string;
  request?: any;
  response?: any;
  blocked?: boolean;
}

export async function runAttackStep(
  attackId: string,
  runId: string,
  stepIndex: number
): Promise<StepResult> {
  const res = await fetch(`${GATEWAY_URL}/attack/${attackId}/${runId}/step/${stepIndex}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}


/**
 * Drives one attack (1-7) start -> every step -> completion in a single call.
 * Used by the Intake "Red Team Agent" trigger: fired on demand, alongside
 * normal customer ticket traffic, landing on the same live Board/Docket via
 * the attacksRouter's existing emitStateSequence path.
 */
export async function runAttackToCompletion(
  attackId: string,
  onStep?: (step: StepResult, index: number, total: number) => void
): Promise<{ title: string; steps: StepResult[]; final: StepResult }> {
  const started = await startAttack(attackId);
  const steps: StepResult[] = [];
  for (let i = 0; i < started.steps.length; i++) {
    const result = await runAttackStep(attackId, started.runId, i);
    steps.push(result);
    onStep?.(result, i, started.steps.length);
  }
  return { title: started.title, steps, final: steps[steps.length - 1] };
}

export async function resetDemo(): Promise<{ finance: unknown; admin: unknown }> {
  const res = await fetch(`${GATEWAY_URL}/demo/reset-all`, { method: "POST" });
  return res.json();
}

// ---------------------------------------------------------------------------
// Live event stream
// ---------------------------------------------------------------------------
export function subscribeToEvents(onEntry: (entry: AuditEntry) => void): () => void {
  const source = new EventSource(`${GATEWAY_URL}/events`);
  source.onmessage = (e) => {
    try {
      onEntry(JSON.parse(e.data));
    } catch {
      // ignore malformed events
    }
  };
  return () => source.close();
}

// ---------------------------------------------------------------------------
// Health checks — for the instrument-panel status strip
// ---------------------------------------------------------------------------
export interface ServiceHealth {
  name: string;
  url: string;
  up: boolean;
}

const SERVICES: { name: string; url: string }[] = [
  { name: "issuer-service", url: ISSUER_URL },
  { name: "proving-service", url: PROVING_URL },
  { name: "finance-mcp", url: FINANCE_URL },
  { name: "support-agent", url: SUPPORT_URL },
  { name: "admin-mcp", url: ADMIN_URL },
  { name: "demo-gateway", url: GATEWAY_URL },
];

export async function checkAllHealth(): Promise<ServiceHealth[]> {
  return Promise.all(
    SERVICES.map(async (s) => {
      try {
        const res = await fetch(`${s.url}/health`, { signal: AbortSignal.timeout(2000) });
        return { ...s, up: res.ok };
      } catch {
        return { ...s, up: false };
      }
    })
  );
}