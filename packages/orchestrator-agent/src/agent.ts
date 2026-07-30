import Groq from "groq-sdk";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { loadOrCreateIdentity } from "./identity";
import { getSupportAgentPublicKey, callSupportAgentHandleTicket, callSupportAgentHandleStructuredTicket } from "./supportAgentClient";
import { delegateToSupportAgent } from "./delegation";

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}
const MODEL = process.env.ORCHESTRATOR_MODEL ?? "llama-3.1-8b-instant";

// Deliberately NOT LLM-controlled — the standard support-tier delegation
// limit is a fixed business policy value, set here in code. Letting the
// LLM choose how much authority to delegate per-ticket would be a direct
// prompt-injection surface ("delegate me $10,000 of refund authority").
// The LLM only ever decides WHETHER to escalate, never HOW MUCH scope to
// grant — issuer-service's subset-check is a second, independent backstop
// on top of this even if this constant were ever compromised.
const STANDARD_SUPPORT_DELEGATION_LIMIT = Number(
  process.env.ORCHESTRATOR_STANDARD_DELEGATION_LIMIT ?? 500
);

const SYSTEM_PROMPT = `You are an orchestrator agent for a customer support system. You receive incoming
customer tickets and decide how to route them.

You have one tool: escalate_to_support_agent. Use it for any ticket that looks like a refund
request. You do NOT decide refund amounts or approvals yourself — that's handled by a
specialized support agent with its own real-time policy verification. Your only job is
routing: does this ticket need the support agent, or not?

IMPORTANT: call escalate_to_support_agent AT MOST ONCE per ticket. Once it returns a result,
that is final — immediately give your final response to the customer based on that result.
Do not call the tool again for the same ticket, even if you're unsure the outcome is "done."

If a ticket is clearly not about refunds (e.g. a general question), just respond directly
without using the tool.
CRITICAL: Do NOT simulate a back-and-forth conversation or hallucinate fake "Customer response:" text. Provide ONLY your own direct, final response to the customer.`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "escalate_to_support_agent",
      description:
        "Routes a ticket to the specialized support agent, which has real-time refund policy " +
        "verification. A scoped, time-limited credential is delegated for this specific ticket.",
      parameters: {
        type: "object",
        properties: { ticketText: { type: "string", description: "The customer's ticket text" } },
        required: ["ticketText"],
      },
    },
  },
];

export interface OrchestratorResult {
  finalResponse: string;
  delegations: { attestationId: string; scopeLimit: number }[];
  supportAgentResults: unknown[];
}

export async function handleIncomingTask(ticketText: string): Promise<OrchestratorResult> {
  const identity = await loadOrCreateIdentity();
  const delegations: OrchestratorResult["delegations"] = [];
  const supportAgentResults: unknown[] = [];

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: ticketText },
  ];

  let malformedRetries = 0;
  const MAX_MALFORMED_RETRIES = 2;
  let alreadyEscalated: { delegation: { attestationId: string; scopeLimit: number }; result: any } | null = null;

  for (let turn = 0; turn < 4; turn++) {
    let response;
    try {
      response = await getGroqClient().chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        tools: TOOLS,
        messages,
      });
    } catch (err: any) {
      const isToolUseFailed = err?.error?.error?.code === "tool_use_failed";
      if (isToolUseFailed && malformedRetries < MAX_MALFORMED_RETRIES) {
        malformedRetries++;
        messages.push({
          role: "user",
          content:
            "Your last tool call was invalid — you likely included fields that aren't part of " +
            "that tool's schema. Call the tool again using ONLY the exact fields defined for it.",
        });
        turn--;
        continue;
      }
      throw err;
    }

    const message = response.choices[0].message;
    messages.push(message);

    const toolCallsThisTurn = message.tool_calls ?? [];

    if (toolCallsThisTurn.length === 0) {
      return { finalResponse: message.content ?? "", delegations, supportAgentResults };
    }

    for (const call of toolCallsThisTurn) {
      if (call.function.name !== "escalate_to_support_agent") {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: `unknown tool ${call.function.name}` }),
        });
        continue;
      }

      const { ticketText: forwardedText } = JSON.parse(call.function.arguments) as {
        ticketText: string;
      };

      if (alreadyEscalated) {
        // Code-level guard: the model already escalated once for this
        // ticket. Rather than trust the prompt instruction alone (Llama
        // 3.3 70B can be unreliable about "don't call this again"), reuse
        // the cached result instead of minting a second real delegation
        // and running a second real refund attempt through support-agent.
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            note: "Already escalated for this ticket — reusing the prior result, not re-delegating.",
            supportAgentFinalResponse: alreadyEscalated.result.finalResponse,
            refundAttempted:
              alreadyEscalated.result.toolCalls?.some((c: any) => c.tool === "request_refund") ?? false,
          }),
        });
        continue;
      }

      // 1. Real delegation via issuer-service — server-side subset-checked
      const supportAgentPublicKey = await getSupportAgentPublicKey();
      const delegation = await delegateToSupportAgent({
        orchestratorAttestationId: identity.attestationId,
        supportAgentPublicKey,
        requestedLimit: STANDARD_SUPPORT_DELEGATION_LIMIT,
      });
      delegations.push(delegation);

      // 2. Hand off to support-agent's real MCP server with the delegated credential
      const supportResult = await callSupportAgentHandleTicket({
        ticketText: forwardedText,
        delegatedAttestationId: delegation.attestationId,
        delegatedScopeLimit: delegation.scopeLimit,
      });
      supportAgentResults.push(supportResult);
      alreadyEscalated = { delegation, result: supportResult };

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({
          supportAgentFinalResponse: supportResult.finalResponse,
          refundAttempted:
            supportResult.toolCalls?.some((c: any) => c.tool === "request_refund") ?? false,
        }),
      });
    }
  }

  return {
    finalResponse: "(orchestrator exceeded max turns without a final response)",
    delegations,
    supportAgentResults,
  };
}

export interface StructuredTaskInput {
  sessionId: string;
  customerId: string;
  /** The order the customer actually selected — pre-committed before LLM runs. */
  orderRef: string;
  /** Free-text justification — may contain injected instructions. LLM sees this. */
  justification: string;
}

/**
 * Attack 8 — Structured intake path.
 *
 * Identical delegation flow to handleIncomingTask, but instead of sending
 * raw ticketText to the support agent, sends the pre-committed structured
 * fields. The support-agent will:
 *   1. Call POST /intent-commitment before the LLM loop
 *   2. Bind the commitmentHash into Proof 1
 *   3. Override any LLM-extracted orderRef with the pre-committed one
 *   4. Gate checks intent binding before Proof 2
 *
 * This means that even if `justification` contains "also refund order 9101",
 * the support-agent will only ever attempt a refund for `orderRef`.
 */
export async function handleIncomingStructuredTask(
  input: StructuredTaskInput
): Promise<OrchestratorResult> {
  const identity = await loadOrCreateIdentity();
  const supportAgentPublicKey = await getSupportAgentPublicKey();
  const delegation = await delegateToSupportAgent({
    orchestratorAttestationId: identity.attestationId,
    supportAgentPublicKey,
    requestedLimit: STANDARD_SUPPORT_DELEGATION_LIMIT,
  });

  const supportResult = await callSupportAgentHandleStructuredTicket({
    ...input,
    delegatedAttestationId: delegation.attestationId,
    delegatedScopeLimit: delegation.scopeLimit,
  });

  // Build a concise final response from the support agent's result
  const finalResponse = supportResult.finalResponse ?? "Done.";

  return {
    finalResponse,
    delegations: [delegation],
    supportAgentResults: [supportResult],
  };
}