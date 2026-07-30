import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const FINANCE_MCP_URL = process.env.FINANCE_MCP_URL ?? "http://localhost:4003/mcp";

let client: Client | null = null;

export async function getFinanceClient(): Promise<Client> {
  if (client) return client;

  const transport = new StreamableHTTPClientTransport(new URL(FINANCE_MCP_URL));
  const c = new Client({ name: "support-agent", version: "0.0.1" }, { capabilities: {} });
  await c.connect(transport);
  client = c;
  return c;
}

export async function lookupOrder(orderRef: string): Promise<any> {
  const c = await getFinanceClient();
  const result = await c.callTool({ name: "lookup_order", arguments: { orderRef } });
  const content = (result.content as any[])[0];
  if (result.isError) throw new Error(content.text);
  return JSON.parse(content.text);
}

export async function callIssueRefund(args: Record<string, unknown>): Promise<any> {
  const c = await getFinanceClient();
  const result = await c.callTool({ name: "issue_refund", arguments: args });
  const content = (result.content as any[])[0];
  return { ...JSON.parse(content.text), isError: result.isError ?? false };
}