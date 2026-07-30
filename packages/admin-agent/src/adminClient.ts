import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ADMIN_MCP_URL = process.env.ADMIN_MCP_URL ?? "http://localhost:4005/mcp";

let client: Client | null = null;

export async function getAdminClient(): Promise<Client> {
  if (client) return client;
  const transport = new StreamableHTTPClientTransport(new URL(ADMIN_MCP_URL));
  const c = new Client({ name: "admin-agent", version: "0.0.1" }, { capabilities: {} });
  await c.connect(transport);
  client = c;
  return c;
}

export async function lookupAccount(accountRef: string): Promise<any> {
  const c = await getAdminClient();
  const result = await c.callTool({ name: "lookup_account", arguments: { accountRef } });
  const content = (result.content as any[])[0];
  if (result.isError) throw new Error(content.text);
  return JSON.parse(content.text);
}

export async function callDeleteAccount(args: Record<string, unknown>): Promise<any> {
  const c = await getAdminClient();
  const result = await c.callTool({ name: "delete_account", arguments: args });
  const content = (result.content as any[])[0];
  return { ...JSON.parse(content.text), isError: result.isError ?? false };
}