import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";

export const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_order",
      description:
        "Free, ungated lookup of a real order by orderRef. Returns amount, account age, past refund count, " +
        "transaction age, who owns it, and whether the standard policy would approve a refund on it. Use this " +
        "to find real orderRefs before attempting any stateful attack call — inventing an orderRef will just " +
        "return 'not found' and waste a turn.",
      parameters: {
        type: "object",
        properties: { orderRef: { type: "string" } },
        required: ["orderRef"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_refund",
      description:
        "Submit a real refund request (Attack 1 - Replay target). No nonce/idempotency key involved — an " +
        "identical request can be submitted more than once.",
      parameters: {
        type: "object",
        properties: { customerId: { type: "string" }, orderRef: { type: "string" } },
        required: ["customerId", "orderRef"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_confused_deputy",
      description:
        "Submit a request with a caller-chosen action field (Attack 2 target). action is normally 'refund' but " +
        "nothing on the server stops you from passing a different action string like 'delete'.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          orderRef: { type: "string" },
          action: { type: "string", description: "e.g. 'refund' or 'delete'" },
        },
        required: ["customerId", "orderRef", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_privilege_escalation",
      description:
        "Submit a refund request with an optional caller-claimed policy limit (Attack 3 target). If claimedLimit " +
        "is omitted the server uses the real $150 policy limit; if provided, the server naively substitutes it " +
        "into the approval check.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          orderRef: { type: "string" },
          claimedLimit: { type: "number", description: "a policy limit you claim applies to you" },
        },
        required: ["customerId", "orderRef"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_idor",
      description:
        "Submit a refund request with ONLY an orderRef — no customerId / ownership check is performed by this " +
        "endpoint at all (Attack 4 target). Use this to test whether an order you don't own gets refunded.",
      parameters: {
        type: "object",
        properties: { orderRef: { type: "string" } },
        required: ["orderRef"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_cross_service",
      description:
        "Submit a refund request claiming an arbitrary origin service (Attack 5 target). serviceHeader is " +
        "caller-supplied and not checked against any real audience/credential binding.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          orderRef: { type: "string" },
          serviceHeader: { type: "string", description: "e.g. 'admin-service', a service you were never issued credentials for" },
        },
        required: ["customerId", "orderRef"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_session",
      description: "Create a session for a customerId (Attack 6 setup step 1). Returns a real sessionId.",
      parameters: {
        type: "object",
        properties: { customerId: { type: "string" } },
        required: ["customerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "revoke_session",
      description: "Revoke a real sessionId (Attack 6 setup step 2 — simulates a detected compromise).",
      parameters: {
        type: "object",
        properties: { sessionId: { type: "string" } },
        required: ["sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_toctou_refund",
      description:
        "Submit a refund request presenting a sessionId (Attack 6 target). Use a sessionId you already revoked " +
        "to test whether the server re-checks revocation at use time.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          orderRef: { type: "string" },
          sessionId: { type: "string" },
        },
        required: ["customerId", "orderRef", "sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_fake_compliance",
      description:
        "Submit a refund request with optional caller-supplied fakeFields (Attack 7 target) — amount, " +
        "accountAgeDays, pastRefundCount, transactionAgeDays. If provided, the server evaluates policy against " +
        "these instead of the real DB values for this order.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          orderRef: { type: "string" },
          fakeFields: {
            type: "object",
            properties: {
              amount: { type: "number" },
              accountAgeDays: { type: "number" },
              pastRefundCount: { type: "number" },
              transactionAgeDays: { type: "number" },
            },
          },
        },
        required: ["customerId", "orderRef"],
      },
    },
  },
];
