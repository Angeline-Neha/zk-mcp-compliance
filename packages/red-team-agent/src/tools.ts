import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";

export const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "register_attacker",
      description:
        "Register a new agent identity with the real Issuer service, requesting a scoped attestation. " +
        "This is a genuinely legitimate registration — it only becomes an attack based on what you do afterward.",
      parameters: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "Unique id for this attacker identity" },
          scope: {
            type: "object",
            properties: {
              action: { type: "string", description: "e.g. issue_refund, delete_account" },
              limit: { type: "number", description: "optional monetary limit for issue_refund" },
            },
            required: ["action"],
          },
        },
        required: ["agentId", "scope"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delegate_scope",
      description:
        "Ask the real Issuer to delegate a new, narrower attestation from a parent identity's attestation to a " +
        "new child identity. The Issuer independently enforces that the child's requested scope is a subset of " +
        "the parent's held scope — this call will genuinely fail if you try to escalate.",
      parameters: {
        type: "object",
        properties: {
          parentAgentId: { type: "string", description: "an agentId you already registered or delegated" },
          childAgentId: { type: "string" },
          requestedScope: {
            type: "object",
            properties: { action: { type: "string" }, limit: { type: "number" } },
            required: ["action"],
          },
          expirySeconds: { type: "number" },
        },
        required: ["parentAgentId", "childAgentId", "requestedScope"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_nonce",
      description: "Request a real, single-use nonce (TTL ~60s) from the Issuer for a given scope+serverId.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string" },
          serverId: { type: "string", description: "e.g. finance-mcp-server, admin-mcp-server" },
        },
        required: ["scope", "serverId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_proof",
      description:
        "Generate a real Schnorr/Fiat-Shamir sigma proof for an identity you already registered/delegated, " +
        "binding it to a scope, nonce, and serverId. You choose what serverId to bind it to — it does not have " +
        "to match where you actually intend to submit it.",
      parameters: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          scope: { type: "string" },
          nonce: { type: "string" },
          serverId: { type: "string" },
        },
        required: ["agentId", "scope", "nonce", "serverId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_proof1",
      description:
        "Submit a sigma proof directly to the Issuer's /verify endpoint for authorization checking, bypassing " +
        "the MCP tool layer. Useful for testing Proof 1 in isolation (replay, forged attestationId, revoked " +
        "credentials). You may pass an attestationId that was never actually issued to you.",
      parameters: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          attestationId: {
            type: "string",
            description: "optional — defaults to the real one for agentId; pass a fabricated id to test attack 4",
          },
          proof: {
            type: "object",
            properties: { R: { type: "string" }, s: { type: "string" } },
            required: ["R", "s"],
          },
          nonce: { type: "string" },
          serverId: { type: "string" },
          requestedScope: {
            type: "object",
            properties: { action: { type: "string" }, limit: { type: "number" } },
            required: ["action"],
          },
        },
        required: ["agentId", "proof", "nonce", "serverId", "requestedScope"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "revoke_attestation",
      description: "Ask the Issuer to revoke a real attestation (simulating a compromise being detected).",
      parameters: {
        type: "object",
        properties: { attestationId: { type: "string" }, reason: { type: "string" } },
        required: ["attestationId", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prove_compliance",
      description:
        "Generate a real Groth16 compliance proof for a refund via the proving service. Set forgeFakePolicy=true " +
        "to attempt forging a self-consistent but fake, more lenient policy commitment (attack 7) instead of " +
        "using the real registered policy.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          accountAgeDays: { type: "number" },
          pastRefundCount: { type: "number" },
          transactionAgeDays: { type: "number" },
          forgeFakePolicy: { type: "boolean" },
          fakePolicyLimit: { type: "number" },
        },
        required: ["amount", "accountAgeDays", "pastRefundCount", "transactionAgeDays"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "call_mcp_tool",
      description:
        "Call a real MCP tool (issue_refund, delete_account, lookup_order, lookup_account) against the actually " +
        "running finance-mcp-server or admin-mcp-server over real JSON-RPC. This runs through the FULL live " +
        "gate (Proof 1 + intent-binding + Proof 2) — a successful call here is a genuine bypass, not simulated.",
      parameters: {
        type: "object",
        properties: {
          serverId: { type: "string", enum: ["finance-mcp-server", "admin-mcp-server"] },
          toolName: { type: "string" },
          arguments: { type: "object", description: "exact arguments object the tool expects" },
        },
        required: ["serverId", "toolName", "arguments"],
      },
    },
  },
];
