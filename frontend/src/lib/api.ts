// Base URLs — override via .env if services run on different hosts/ports
export const ISSUER_URL = import.meta.env.VITE_ISSUER_URL ?? "http://localhost:4001";
export const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:4006";
export const FINANCE_URL = import.meta.env.VITE_FINANCE_URL ?? "http://localhost:4003";
export const PROVING_URL = import.meta.env.VITE_PROVING_URL ?? "http://localhost:4002";
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? "http://localhost:4005";
export const SUPPORT_URL = import.meta.env.VITE_SUPPORT_URL ?? "http://localhost:4004";

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
}): Promise<TaskResult> {
  const res = await fetch(`${GATEWAY_URL}/task/structured`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
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
  request?: unknown;
  response?: unknown;
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