import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { loadOrCreateIdentity } from "./identity";
import { handleTicket } from "./agent";
import type { StructuredTicket } from "./agent";

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "support-agent", version: "0.0.1" },
    { capabilities: {} }
  );

  server.registerTool(
    "get_public_key",
    {
      title: "Get Public Key",
      description:
        "Returns this agent's public key, so a parent agent (e.g. orchestrator-agent) " +
        "can delegate a scoped attestation to it. Never exposes the secret key.",
      inputSchema: {},
    },
    async () => {
      const identity = await loadOrCreateIdentity();
      return {
        content: [{ type: "text", text: JSON.stringify({ publicKey: identity.publicKey }) }],
      };
    }
  );

  server.registerTool(
    "handle_ticket",
    {
      title: "Handle Support Ticket",
      description:
        "Runs a customer support ticket through this agent's real LLM tool-calling loop. " +
        "For Attack 8 (intent-binding), pass sessionId + customerId + orderRef + justification. " +
        "For the legacy path (attacks 1-7, backward-compat), pass ticketText only.",
      inputSchema: {
        // --- Legacy path (attacks 1-7, unstructured) ---
        ticketText: z.string().optional(),
        // --- Attack 8: structured intent-binding path ---
        sessionId: z.string().optional(),
        customerId: z.string().optional(),
        orderRef: z.string().optional(),
        justification: z.string().optional(),
        // --- Delegation (unchanged) ---
        delegatedAttestationId: z.string().uuid().optional(),
        delegatedScopeLimit: z.number().positive().optional(),
      },
    },
    async ({ ticketText, sessionId, customerId, orderRef, justification, delegatedAttestationId, delegatedScopeLimit }) => {
      const delegation =
        delegatedAttestationId && delegatedScopeLimit
          ? { attestationId: delegatedAttestationId, scopeLimit: delegatedScopeLimit }
          : undefined;

      // Dispatch: structured (Attack 8) vs. legacy string path
      let ticket: StructuredTicket | string;
      if (sessionId && customerId && orderRef && justification) {
        ticket = { sessionId, customerId, orderRef, justification };
      } else if (ticketText) {
        ticket = ticketText;
      } else {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Provide either ticketText or all of sessionId/customerId/orderRef/justification" }) }],
          isError: true,
        };
      }

      const result = await handleTicket(ticket, delegation);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

export const app = createMcpExpressApp();
app.use(require("cors")());
app.post("/mcp", async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));