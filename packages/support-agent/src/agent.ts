import Groq from "groq-sdk";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { loadOrCreateIdentity, AGENT_ID } from "./identity";
import { lookupOrder as mcpLookupOrder, callIssueRefund } from "./financeClient";
import { assembleRefundProofs } from "./proofGen";

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}
const MODEL = process.env.SUPPORT_AGENT_MODEL ?? "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are a customer support agent for an e-commerce company, handling refund requests.

Company refund policy (auto-approval requires ALL of these):
- Refund amount is $150 or less
- Customer account is at least 30 days old
- Customer has had fewer than 3 refunds in the past 90 days
- The original transaction is 120 days old or less (standard chargeback-dispute window)

If a request doesn't meet all four criteria, it should be escalated to human review, not auto-approved.
You do not have override authority — the system will independently verify every refund attempt against
the real policy before anything is actually issued, regardless of what you decide.

You have two tools:
- lookup_order: look up real order data before deciding what to do
- request_refund: attempt to actually issue a refund for an order

Always look up the order first. Then decide whether to attempt the refund or explain to the
customer why it needs human review. Be honest and helpful in your final response to the customer.`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_order",
      description: "Look up real data for an order: amount, account age, past refund count, transaction age.",
      parameters: {
        type: "object",
        properties: { orderRef: { type: "string", description: "The order reference number" } },
        required: ["orderRef"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_refund",
      description:
        "Attempt to actually issue a refund for an order. This is a real, privileged action — it will " +
        "be independently verified against the real policy before anything happens, regardless of your reasoning.",
      parameters: {
        type: "object",
        properties: {
          orderRef: { type: "string", description: "The order reference number to refund" },
          justification: { type: "string", description: "Brief reason for attempting this refund" },
        },
        required: ["orderRef", "justification"],
      },
    },
  },
];

export interface TicketResult {
  finalResponse: string;
  toolCalls: { tool: string; input: unknown; result: unknown }[];
}

/**
 * Runs a single support ticket through the real tool-calling loop (Groq /
 * Llama 3.3 70B). The LLM decides what to do; this function executes
 * whatever it decides, including running the real two-proof pipeline if
 * it calls request_refund. The LLM's decision is NEVER the final word on
 * whether a refund happens — the gate (via finance-mcp-server) is.
 *
 * @param ticketText the customer's request
 * @param delegation if provided (e.g. by orchestrator-agent after a real
 *   /delegate call), this attestation + limit is used for the refund
 *   attempt INSTEAD of this agent's self-registered one.
 */
export async function handleTicket(
  ticketText: string,
  delegation?: { attestationId: string; scopeLimit: number }
): Promise<TicketResult> {
  const identity = await loadOrCreateIdentity();
  const attestationId = delegation?.attestationId ?? identity.attestationId;
  const scopeLimit = delegation?.scopeLimit ?? Number(process.env.SUPPORT_AGENT_REFUND_LIMIT ?? 500);
  const toolCalls: TicketResult["toolCalls"] = [];

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: ticketText },
  ];

  let malformedRetries = 0;
  const MAX_MALFORMED_RETRIES = 2;

  for (let turn = 0; turn < 6; turn++) {
    let response;
    try {
      response = await getGroqClient().chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        tools: TOOLS,
        messages,
      });
    } catch (err: any) {
      // Llama 3.3 70B occasionally hallucinates extra/invalid arguments
      // into a tool call (a known quirk of smaller/faster open models vs
      // frontier ones) — Groq rejects these with tool_use_failed. Rather
      // than crash the whole ticket, nudge the model to retry correctly,
      // up to a small retry budget.
      const isToolUseFailed = err?.error?.error?.code === "tool_use_failed";
      if (isToolUseFailed && malformedRetries < MAX_MALFORMED_RETRIES) {
        malformedRetries++;
        messages.push({
          role: "user",
          content:
            "Your last tool call was invalid — you likely included fields that aren't part of " +
            "that tool's schema. Call the tool again using ONLY the exact fields defined for it.",
        });
        turn--; // don't count a malformed attempt against the real turn budget
        continue;
      }
      throw err;
    }

    const message = response.choices[0].message;
    messages.push(message);

    const toolCallsThisTurn = message.tool_calls ?? [];

    if (toolCallsThisTurn.length === 0) {
      // model produced a final text response, no more tool calls
      return { finalResponse: message.content ?? "", toolCalls };
    }

    for (const call of toolCallsThisTurn) {
      let resultPayload: unknown;
      const input = JSON.parse(call.function.arguments);

      if (call.function.name === "lookup_order") {
        const { orderRef } = input as { orderRef: string };
        try {
          resultPayload = await mcpLookupOrder(orderRef);
        } catch (err: any) {
          resultPayload = { error: err.message };
        }
      } else if (call.function.name === "request_refund") {
        const { orderRef } = input as { orderRef: string; justification: string };
        resultPayload = await attemptRefund(identity, attestationId, scopeLimit, orderRef);
      } else {
        resultPayload = { error: `unknown tool ${call.function.name}` };
      }

      toolCalls.push({ tool: call.function.name, input, result: resultPayload });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(resultPayload),
      });
    }
  }

  return { finalResponse: "(agent exceeded max turns without a final response)", toolCalls };
}

/**
 * The real refund attempt: look up real order data, generate BOTH real
 * proofs from that real data, and call the actual gated MCP tool. This
 * runs identically regardless of the LLM's stated justification — a
 * prompt-injected ticket that gets the model to attempt something the
 * real order data doesn't support will still be evaluated honestly here,
 * and the gate (not the LLM, not this function) makes the final call.
 */
async function attemptRefund(
  identity: { secretKey: string; publicKey: string; attestationId: string },
  attestationId: string,
  scopeLimit: number,
  orderRef: string
) {
  const order = await mcpLookupOrder(orderRef);
  if (order?.error) return { allowed: false, reason: order.error };

  let proofs;
  try {
    proofs = await assembleRefundProofs(identity, {
      amount: order.amount,
      accountAgeDays: order.accountAgeDays,
      pastRefundCount: order.pastRefundCount,
      transactionAgeDays: order.transactionAgeDays,
    });
  } catch (err: any) {
    return { allowed: false, reason: err.message };
  }

  const result = await callIssueRefund({
    agentId: AGENT_ID,
    attestationId,
    requestedScope: { action: "issue_refund", limit: scopeLimit },
    sigmaProof: proofs.sigmaProof,
    nonce: proofs.nonce,
    orderRef,
    claimedAmount: proofs.claimedAmount,
    claimedAmountSalt: proofs.claimedAmountSalt,
    complianceProof: proofs.complianceProof,
  });

  return result;
}