import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { loadOrCreateIdentity } from "./identity";
import { handleTicket } from "./agent";

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
        "If a delegated attestationId + scopeLimit are provided (from a real /delegate call), " +
        "that credential is used for any refund attempt instead of this agent's own.",
      inputSchema: {
        ticketText: z.string().min(1),
        delegatedAttestationId: z.string().uuid().optional(),
        delegatedScopeLimit: z.number().positive().optional(),
      },
    },
    async ({ ticketText, delegatedAttestationId, delegatedScopeLimit }) => {
      const delegation =
        delegatedAttestationId && delegatedScopeLimit
          ? { attestationId: delegatedAttestationId, scopeLimit: delegatedScopeLimit }
          : undefined;

      const result = await handleTicket(ticketText, delegation);
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