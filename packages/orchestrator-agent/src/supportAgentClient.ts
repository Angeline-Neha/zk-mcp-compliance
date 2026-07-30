import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SUPPORT_AGENT_MCP_URL = process.env.SUPPORT_AGENT_MCP_URL ?? "http://localhost:4004/mcp";

let client: Client | null = null;

async function getSupportAgentClient(): Promise<Client> {
  if (client) return client;
  const transport = new StreamableHTTPClientTransport(new URL(SUPPORT_AGENT_MCP_URL));
  const c = new Client({ name: "orchestrator-agent", version: "0.0.1" }, { capabilities: {} });
  await c.connect(transport);
  client = c;
  return c;
}

export async function getSupportAgentPublicKey(): Promise<string> {
  const c = await getSupportAgentClient();
  const result = await c.callTool({ name: "get_public_key", arguments: {} });
  const content = (result.content as any[])[0];
  return JSON.parse(content.text).publicKey;
}

export async function callSupportAgentHandleTicket(args: {
  ticketText: string;
  delegatedAttestationId: string;
  delegatedScopeLimit: number;
}): Promise<any> {
  const c = await getSupportAgentClient();
  const result = await c.callTool({ name: "handle_ticket", arguments: args });
  const content = (result.content as any[])[0];
  if (result.isError) {
    // handle_ticket failed before producing a structured TicketResult
    // (e.g. the underlying LLM call itself errored) — surface the raw
    // message rather than crashing on JSON.parse of a plain string.
    throw new Error(`support-agent handle_ticket failed: ${content.text}`);
  }
  return JSON.parse(content.text);
}

/**
 * Attack 8 — Structured intake path.
 * Forwards the pre-committed sessionId/customerId/orderRef/justification
 * fields to the support-agent's handle_ticket tool so intent-binding
 * is enforced end-to-end.
 */
export async function callSupportAgentHandleStructuredTicket(args: {
  sessionId: string;
  customerId: string;
  orderRef: string;
  justification: string;
  delegatedAttestationId: string;
  delegatedScopeLimit: number;
}): Promise<any> {
  const c = await getSupportAgentClient();
  const result = await c.callTool({ name: "handle_ticket", arguments: args });
  const content = (result.content as any[])[0];
  if (result.isError) {
    throw new Error(`support-agent handle_ticket (structured) failed: ${content.text}`);
  }
  return JSON.parse(content.text);
}