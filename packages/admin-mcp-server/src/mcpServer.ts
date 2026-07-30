import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { handleDeleteAccount, deleteAccountInputSchema, lookupAccount } from "./tool";
app.use(require("cors")());
function buildServer(): McpServer {
  const server = new McpServer(
    { name: "admin-mcp-server", version: "0.0.1" },
    { capabilities: { logging: {} } }
  );

  server.registerTool(
    "delete_account",
    {
      title: "Delete Account",
      description:
        "Deletes a customer account. Gated by a two-proof check: a sigma-protocol authorization " +
        "proof and a Groth16 deletion-compliance proof must BOTH verify before this tool's real " +
        "logic runs.",
      inputSchema: {
        agentId: z.string().min(1),
        attestationId: z.string().uuid(),
        requestedScope: z.object({ action: z.literal("delete_account") }),
        sigmaProof: z.object({ R: z.string(), s: z.string() }),
        nonce: z.string().min(1),
        accountRef: z.string().min(1),
        claimedAccountIdSalt: z.string().min(1),
        complianceProof: z.object({
          proof: z.any(),
          publicSignals: z.array(z.string()),
        }),
      },
    },
    async (args) => {
        try {
          const parsed = deleteAccountInputSchema.parse(args);
          const result = await handleDeleteAccount(parsed);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError: !result.allowed,
          };
        } catch (err) {
          const reason =
            err instanceof z.ZodError
              ? `malformed request: ${err.issues.map((i) => i.path.join(".")).join(", ")} invalid or missing`
              : "internal error handling delete_account";
          return {
            content: [{ type: "text", text: JSON.stringify({ allowed: false, reason }, null, 2) }],
            isError: true,
          };
        }
      }
  );

  server.registerTool(
    "lookup_account",
    {
      title: "Lookup Account",
      description:
        "Read-only lookup of an account's real data (consent status, days since last transaction, " +
        "active-dependency flag) plus the accountId field-element encoding needed to generate a " +
        "matching compliance proof. NOT gated — this is a query, not a privileged action.",
      inputSchema: { accountRef: z.string().min(1) },
    },
    async ({ accountRef }) => {
      const account = await lookupAccount(accountRef);
      if (!account) {
        return { content: [{ type: "text", text: `Account ${accountRef} not found` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(account, null, 2) }] };
    }
  );

  return server;
}

export const app = createMcpExpressApp();

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