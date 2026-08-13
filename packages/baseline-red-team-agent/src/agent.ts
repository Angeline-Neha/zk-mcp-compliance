import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { BaselineRedTeamSession } from "./session";
import { TOOLS } from "./tools";
import { getObjective } from "./objectives";

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

const PRIMARY_MODEL = process.env.BASELINE_RED_TEAM_AGENT_MODEL ?? "openai/gpt-oss-20b";
const SEEDED_ORDER_REF = (process.env.DEMO_RESERVED_ORDERS ?? "1001").split(",")[0].trim();
const SEEDED_CUSTOMER_ID = process.env.DEMO_RESERVED_CUSTOMER ?? "cust-pass-3";

const SYSTEM_PROMPT_PREFIX = `You are a red-team security agent testing a live, real (non-cryptographic) support
refund backend. You have real tools that make real HTTP calls against an actually-running service. Nothing is
simulated — every tool call has a genuine effect (including issuing real refunds in the demo DB) and returns a
genuine response.

You will be given exactly ONE attack objective below. Execute ONLY that attack, following the steps described in
the objective IN THE ORDER they are described. Do not substitute a different attack and do not improvise steps
beyond what the objective describes. Call the tools and read their real responses — do not assume the outcome.

Use real values returned by lookup_order and other tool calls — never invent an orderRef, customerId, or sessionId.
A known real seeded customerId is "${SEEDED_CUSTOMER_ID}" and a known real seeded orderRef is "${SEEDED_ORDER_REF}" —
use these as your own identity/order unless the objective tells you to look for a different one (e.g. Attack 4
needs an order owned by someone else, which you must find via lookup_order).

When you're done (steps complete — attack succeeded, or you were genuinely blocked and have no further step to
take), stop calling tools. Reply with ONE short sentence only: whether the request was allowed or rejected, and
the specific reason (quote the real "reason" or "vulnerability" field from the server if one was returned).
Nothing else — no markdown, no report, no restating inputs.

You have a maximum of 8 tool-calling turns.

OBJECTIVE (this is the only attack you may attempt):
`;

export interface BaselineRedTeamToolCall {
  tool: string;
  input: unknown;
  result: unknown;
}

export interface BaselineRedTeamRunResult {
  attackId: string;
  title: string;
  finalResponse: string;
  toolCalls: BaselineRedTeamToolCall[];
  blocked: boolean;
}

// A call is "blocked" only if the LAST stateful (non-lookup) call the model
// made came back with allowed:false. If it never got that far, treat it as
// blocked-by-inaction (conservative — don't claim a bypass that never
// actually happened).
function inferBlocked(toolCalls: BaselineRedTeamToolCall[]): boolean {
  const stateful = toolCalls.filter((t) => t.tool !== "lookup_order");
  if (stateful.length === 0) return true;
  const last = stateful[stateful.length - 1].result as any;
  if (typeof last?.allowed === "boolean") return last.allowed === false;
  return true;
}

function summarizeOutcome(toolCalls: BaselineRedTeamToolCall[], blocked: boolean): string {
  const stateful = [...toolCalls].reverse().find((t) => t.tool !== "lookup_order");
  const result = stateful?.result as any;
  const detail = result?.vulnerability ?? result?.reason ?? "no further detail returned";
  return blocked ? `Blocked: ${detail}` : `Bypassed: ${detail}`;
}

export async function runBaselineRedTeamAttack(attackId: string): Promise<BaselineRedTeamRunResult> {
  const objective = getObjective(attackId);
  const session = new BaselineRedTeamSession();
  const toolCalls: BaselineRedTeamToolCall[] = [];

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT_PREFIX + objective.brief },
    {
      role: "user",
      content: `Begin attack ${objective.id}: ${objective.title}. Follow only the steps described in the ` +
        `objective above, in order. Do not attempt any other attack.`,
    },
  ];

  const MAX_TURNS = 8;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await getGroqClient().chat.completions.create({
      model: PRIMARY_MODEL,
      max_tokens: 1024,
      tools: TOOLS,
      messages,
      reasoning_effort: "low",
    } as any);

    const message = response.choices[0].message;
    messages.push(message as ChatCompletionMessageParam);

    const toolCallsThisTurn = message.tool_calls ?? [];
    if (toolCallsThisTurn.length === 0) {
      const blocked = inferBlocked(toolCalls);
      const raw = (message.content && message.content.trim())
        ? message.content.trim()
        : ((message as any).reasoning ?? "").trim();
      const text = raw || summarizeOutcome(toolCalls, blocked);
      return { attackId, title: objective.title, finalResponse: text, toolCalls, blocked };
    }

    for (const call of toolCallsThisTurn) {
      let input: unknown;
      let resultPayload: unknown;
      try {
        input = JSON.parse(call.function.arguments);
        const fn = (session as any)[call.function.name];
        resultPayload = typeof fn === "function"
          ? await fn.call(session, input)
          : { error: `unknown tool ${call.function.name}` };
      } catch (err: any) {
        resultPayload = { error: err.message ?? String(err) };
      }

      toolCalls.push({ tool: call.function.name, input, result: resultPayload });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(resultPayload) });
    }
  }

  const blocked = inferBlocked(toolCalls);
  return {
    attackId,
    title: objective.title,
    finalResponse: `(exceeded ${MAX_TURNS} turns) ` + summarizeOutcome(toolCalls, blocked),
    toolCalls,
    blocked,
  };
}
