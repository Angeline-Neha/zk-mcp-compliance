import Groq from "groq-sdk";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { loadOrCreateIdentity, AGENT_ID } from "./identity";
import { lookupAccount as mcpLookupAccount, callDeleteAccount } from "./adminClient";
import { assembleDeletionProofs } from "./proofGen";

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}
const MODEL = process.env.ADMIN_AGENT_MODEL ?? "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are an admin agent for a customer support system, handling account deletion requests.

Company deletion policy (deletion requires ALL of these):
- The account holder has explicitly consented to deletion
- At least 7 years (2555 days) have passed since the account's last financial transaction
  (this is a mandatory legal/business retention floor — it applies even if the customer
  explicitly requests immediate deletion; you cannot override it)
- The account has no active dependency (open order, pending dispute, active subscription)

If a request doesn't meet all three criteria, deletion cannot proceed — explain clearly to
the customer which condition(s) are not met. You do not have override authority — the system
will independently verify every deletion attempt against the real policy before anything is
actually deleted, regardless of what you decide.

You have two tools:
- lookup_account: look up real account data before deciding what to do
- request_deletion: attempt to actually delete an account

Always look up the account first. Be honest and clear with the customer about why a deletion
can or cannot proceed right now.`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_account",
      description:
        "Look up real data for an account: consent status, days since last transaction, active-dependency flag.",
      parameters: {
        type: "object",
        properties: { accountRef: { type: "string", description: "The account reference" } },
        required: ["accountRef"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_deletion",
      description:
        "Attempt to actually delete an account. This is a real, privileged action — it will be " +
        "independently verified against the real policy before anything happens, regardless of your reasoning.",
      parameters: {
        type: "object",
        properties: {
          accountRef: { type: "string", description: "The account reference to delete" },
          justification: { type: "string", description: "Brief reason for attempting this deletion" },
        },
        required: ["accountRef", "justification"],
      },
    },
  },
];

export interface TicketResult {
  finalResponse: string;
  toolCalls: { tool: string; input: unknown; result: unknown }[];
}

export async function handleTicket(
  ticketText: string,
  delegation?: { attestationId: string }
): Promise<TicketResult> {
  const identity = await loadOrCreateIdentity();
  const attestationId = delegation?.attestationId ?? identity.attestationId;
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
      return { finalResponse: message.content ?? "", toolCalls };
    }

    for (const call of toolCallsThisTurn) {
      let resultPayload: unknown;
      const input = JSON.parse(call.function.arguments);

      if (call.function.name === "lookup_account") {
        const { accountRef } = input as { accountRef: string };
        try {
          resultPayload = await mcpLookupAccount(accountRef);
        } catch (err: any) {
          resultPayload = { error: err.message };
        }
      } else if (call.function.name === "request_deletion") {
        const { accountRef } = input as { accountRef: string; justification: string };
        resultPayload = await attemptDeletion(identity, attestationId, accountRef);
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

async function attemptDeletion(
  identity: { secretKey: string; publicKey: string; attestationId: string },
  attestationId: string,
  accountRef: string
) {
  const account = await mcpLookupAccount(accountRef);
  if (account?.error) return { allowed: false, reason: account.error };

  let proofs;
  try {
    proofs = await assembleDeletionProofs(identity, {
      accountRef,
      consentGiven: account.consentGiven,
      daysSinceLastTransaction: account.daysSinceLastTransaction,
      hasActiveDependency: account.hasActiveDependency,
    });
  } catch (err: any) {
    return { allowed: false, reason: err.message };
  }

  const result = await callDeleteAccount({
    agentId: AGENT_ID,
    attestationId,
    requestedScope: { action: "delete_account" },
    sigmaProof: proofs.sigmaProof,
    nonce: proofs.nonce,
    accountRef,
    claimedAccountIdSalt: proofs.claimedAccountIdSalt,
    complianceProof: proofs.complianceProof,
  });

  return result;
}