import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { RedTeamSession } from "./session";
import { TOOLS } from "./tools";
import { getObjective } from "./objectives";

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}
// Tiered model strategy — free-tier TPM budgets make the escalation model
// (larger, more reliable, but tighter per-minute quota) too expensive to run
// by default on every attack. Start cheap; escalate ONLY the current run,
// ONLY after the fabrication guard in session.ts proves the cheap model
// actually needs it (see PRIMARY_MODEL / usedEscalation below).
const PRIMARY_MODEL = process.env.RED_TEAM_AGENT_MODEL ?? "openai/gpt-oss-20b";
const ESCALATION_MODEL = process.env.RED_TEAM_AGENT_ESCALATION_MODEL ?? "openai/gpt-oss-120b";

// Keys whose values must survive trimming byte-for-byte — these are exactly
// the fields session.ts's assertRealNonce/assertRealProof compare against
// what the model sends back on a later turn. Truncating any of these would
// make a genuine attack step fail with a fabrication error that isn't real.
const PROTECTED_KEYS = new Set([
  "nonce", "R", "s", "attestationId", "orderRef", "refundId", "publicKey",
  "agentId", "scope", "serverId", "action", "error", "allowed", "valid", "ok",
  "httpStatus", "reason", "vulnerability", "zkDifference",
]);
const MAX_STRING_LEN = 300;

// Recursively trims long, non-identifier string fields out of a tool result
// before it's pushed into the growing `messages` history — this is what was
// driving 10K+ input tokens by the last turn of a run. Anything in
// PROTECTED_KEYS is left untouched, whatever its length.
function trimForHistory(value: unknown, keyHint?: string): unknown {
  if (typeof value === "string") {
    if (keyHint && PROTECTED_KEYS.has(keyHint)) return value;
    return value.length > MAX_STRING_LEN
      ? value.slice(0, MAX_STRING_LEN) + `…[+${value.length - MAX_STRING_LEN} chars trimmed]`
      : value;
  }
  if (Array.isArray(value)) return value.map((v) => trimForHistory(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = trimForHistory(v, k);
    }
    return out;
  }
  return value;
}

const SYSTEM_PROMPT_PREFIX = `You are a red-team security agent testing a live zero-knowledge MCP compliance
gate. You have real tools that make real network calls against actually-running services (Issuer, Proving
Service, finance-mcp-server, admin-mcp-server). Nothing is simulated — every tool call has a genuine effect and
returns a genuine response.

You will be given exactly ONE attack objective below. Execute ONLY that attack, following the steps described in
the objective IN THE ORDER they are described. Do not substitute a different attack, do not try alternative
strategies, and do not improvise additional steps beyond what the objective describes. If a step fails, you may
retry that same step (e.g. to fix a malformed call), but do not pivot to a different attack technique or a
different objective. Call the tools and read their real responses — do not assume the outcome.

CRITICAL — ALWAYS USE REAL VALUES FROM PRIOR TOOL RESPONSES:
- When a step says "use the nonce from step N", pass EXACTLY the nonce string that was returned in that step's
  response — never substitute "nonce_12345", "nonce1", or any placeholder.
- When a step says "use the attestationId from step N", pass EXACTLY the UUID that was returned — never
  substitute "atker1", "fabricated-attestation-id-123", or any non-UUID string. The server validates UUID format.
- When a step says "use the proof from step N", pass EXACTLY the { R, s } object that was returned.
- Placeholders and invented values will be rejected by the server and the attack will fail trivially — that is
  NOT the gate blocking the attack; it is a caller error.

When you're done (the described steps are complete — attack succeeded, or you were genuinely blocked and have no
further step from the objective to take), stop calling tools and write a final report: what you did, what the
server actually said, and whether the gate held or was bypassed. Be precise about which check blocked you, quoting
the real reason field if one was returned.

You have a maximum of 10 tool-calling turns. If you have not completed the described steps by then, report your
best assessment of what happened so far. Do not use remaining turns to attempt anything outside the objective.

OBJECTIVE (this is the only attack you may attempt):
`;

// True for a network/transport-level failure — dropped connection, DNS,
// timeout — as opposed to a real API error response (bad request, rate
// limit, tool_use_failed). The groq-sdk/OpenAI client throws APIError
// subclasses with a `status` for real API responses; a bare "Connection
// error" or similar has no status because it never got a response at all.
function isInfraError(err: any): boolean {
  if (typeof err?.status === "number") return false; // got a real HTTP response
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("connection error") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

// Retries a Groq call up to twice on a genuine infra failure, with a short
// backoff, before giving up. Real API error responses (rate limits, bad
// requests, tool_use_failed) are NOT retried here — those are handled by
// the caller's existing logic and shouldn't be masked by a blind retry.
async function callGroqWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delaysMs = [500, 1500];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (!isInfraError(err) || attempt >= delaysMs.length) throw err;
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
}

export interface RedTeamToolCall {
  tool: string;
  input: unknown;
  result: unknown;
}

export interface RedTeamRunResult {
  attackId: string;
  title: string;
  finalResponse: string;
  toolCalls: RedTeamToolCall[];
  blocked: boolean;
  // True only when this run gave up because the Groq API call itself failed
  // (network/connection error, timeout) — NOT because the gate rejected
  // anything. `blocked` stays a best-effort guess for backward
  // compatibility, but callers should check this first: a true infra
  // failure is not a demonstration of the gate defending itself, and
  // shouldn't be recorded or narrated as one.
  infraError?: boolean;
}

function inferBlocked(toolCalls: RedTeamToolCall[]): boolean {
  // Walk ALL privileged calls — the attack is considered unblocked only if
  // the LAST privileged action returned a genuine success (allowed: true).
  // Any error shape (error field, non-ok HTTP, or a JSON parse crash) is
  // treated as blocked — the attack didn't get through.
  const privileged = [...toolCalls]
    .reverse()
    .find((t) => t.tool === "call_mcp_tool" || t.tool === "verify_proof1" || t.tool === "delegate_scope");
  if (!privileged) return true; // never even reached a privileged action -> nothing got through

  const r = privileged.result as any;

  if (privileged.tool === "call_mcp_tool") {
    // An error field at any level means the call failed (gate rejected or
    // MCP error returned). allowed: true with no error is the only bypass.
    if (r?.error) return true;
    if (r?.result?.error) return true;
    if (r?.result?.allowed === false) return true;
    if (r?.result?.allowed === true) return false; // genuine bypass
    // MCP tool calls that succeed return an httpStatus 200 and a result
    // without an error field. Treat any unexpected shape as blocked.
    return !(r?.httpStatus === 200 && !r?.result?.error);
  }

  if (privileged.tool === "verify_proof1") {
    // verifyProof1 returns { valid: true } on success, or { error } / { valid: false } on failure.
    if (r?.error) return true;
    return r?.valid !== true;
  }

  if (privileged.tool === "delegate_scope") {
    return r?.ok !== true;
  }

  return true;
}

export async function runRedTeamAttack(attackId: string): Promise<RedTeamRunResult> {
  const objective = getObjective(attackId);
  const session = new RedTeamSession();
  const toolCalls: RedTeamToolCall[] = [];

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT_PREFIX + objective.brief },
    {
      role: "user",
      content: `Begin attack ${objective.id}: ${objective.title}. Follow only the steps described in the ` +
        `objective above, in order. Do not attempt any other attack.`,
    },
  ];

  const MAX_TURNS = 10;
  let malformedRetries = 0;
  const MAX_MALFORMED_RETRIES = 2;
  // Flips true the first time this run hits a fabrication error (the model
  // invented a nonce/proof instead of reusing a real one) — from that turn
  // on, this run pays the escalation model's cost, but only THIS run, and
  // only after proving it actually needs the smarter model.
  let usedEscalation = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let response;
    try {
      response = await callGroqWithRetry(() =>
        getGroqClient().chat.completions.create({
          model: usedEscalation ? ESCALATION_MODEL : PRIMARY_MODEL,
          max_tokens: 1024,
          tools: TOOLS,
          messages,
        })
      );
    } catch (err: any) {
      const isToolUseFailed = err?.error?.error?.code === "tool_use_failed";
      if (isToolUseFailed && malformedRetries < MAX_MALFORMED_RETRIES) {
        malformedRetries++;
        messages.push({
          role: "user",
          content:
            "Your last tool call was invalid — check the exact field names for that tool and try again with " +
            "only the fields it defines.",
        });
        turn--;
        continue;
      }
      // A connection-level failure (dropped connection, timeout, DNS) is an
      // infrastructure problem, not the gate doing anything — don't let it
      // masquerade as a "blocked" verdict. isInfraError() below decides which
      // this was; callers (the demo route) check `infraError` before
      // recording a scoreboard outcome or narrating a fake rejection.
      return {
        attackId,
        title: objective.title,
        finalResponse: `agent error: ${err.message ?? String(err)}`,
        toolCalls,
        blocked: inferBlocked(toolCalls),
        infraError: isInfraError(err),
      };
    }

    const message = response.choices[0].message;
    messages.push(message);

    const toolCallsThisTurn = message.tool_calls ?? [];
    if (toolCallsThisTurn.length === 0) {
      return {
        attackId,
        title: objective.title,
        finalResponse: message.content ?? "",
        toolCalls,
        blocked: inferBlocked(toolCalls),
      };
    }

    for (const call of toolCallsThisTurn) {
      let input: unknown;
      let resultPayload: unknown;
      try {
        input = JSON.parse(call.function.arguments);
        const fn = (session as any)[call.function.name];
        if (typeof fn !== "function") {
          resultPayload = { error: `unknown tool ${call.function.name}` };
        } else {
          resultPayload = await fn.call(session, input);
        }
      } catch (err: any) {
        resultPayload = { error: err.message ?? String(err) };
      }

      toolCalls.push({ tool: call.function.name, input, result: resultPayload });

      // Escalate for the REST of this run once the cheap model proves it
      // needs help — a fabrication error means it invented a value instead
      // of reusing a real one from a prior step.
      const errText = (resultPayload as any)?.error;
      if (typeof errText === "string" && errText.startsWith("REJECTED BEFORE REACHING THE SERVER")) {
        usedEscalation = true;
      }

      // Trimmed, not the raw payload — this is what keeps a 10-turn run's
      // last call from ballooning to 10K+ input tokens. Identifiers the
      // fabrication guard checks later are preserved exactly (see
      // PROTECTED_KEYS above).
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(trimForHistory(resultPayload)),
      });
    }
  }

  return {
    attackId,
    title: objective.title,
    finalResponse: "(agent exceeded max turns without a conclusive final response)",
    toolCalls,
    blocked: inferBlocked(toolCalls),
  };
}
