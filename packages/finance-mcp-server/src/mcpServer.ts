import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { handleIssueRefund, issueRefundInputSchema, lookupOrder } from "./tool";

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "finance-mcp-server", version: "0.0.1" },
    { capabilities: { logging: {} } }
  );

  server.registerTool(
    "issue_refund",
    {
      title: "Issue Refund",
      description:
        "Issues a refund for an order. Gated by a two-proof check: a sigma-protocol " +
        "authorization proof and a Groth16 compliance proof must BOTH verify before " +
        "this tool's real logic runs.",
      inputSchema: {
        agentId: z.string().min(1),
        attestationId: z.string().uuid(),
        requestedScope: z.object({
          action: z.literal("issue_refund"),
          limit: z.number().optional(),
        }),
        sigmaProof: z.object({ R: z.string(), s: z.string() }),
        nonce: z.string().min(1),
        orderRef: z.string().min(1),
        claimedAmount: z.number().positive(),
        claimedAmountSalt: z.string().min(1),
        complianceProof: z.object({
          proof: z.any(),
          publicSignals: z.array(z.string()),
        }),
      },
    },
    async (args) => {
      const parsed = issueRefundInputSchema.parse(args);
      const result = await handleIssueRefund(parsed);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.allowed,
      };
    }
  );

  server.registerTool(
    "lookup_order",
    {
      title: "Lookup Order",
      description:
        "Read-only lookup of an order's real data (amount, account age, past refund " +
        "count, transaction age). NOT gated — this is a query, not a privileged action. " +
        "Use this to decide whether a refund request is worth attempting before calling issue_refund.",
      inputSchema: { orderRef: z.string().min(1) },
    },
    async ({ orderRef }) => {
      const order = await lookupOrder(orderRef);
      if (!order) {
        return { content: [{ type: "text", text: `Order ${orderRef} not found` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(order, null, 2) }] };
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
