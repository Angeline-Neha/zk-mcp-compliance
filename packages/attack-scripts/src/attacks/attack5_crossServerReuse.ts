import { AttackResult, ADMIN_URL, registerAgent, getNonce } from "../common";
import { generateProof } from "@zk-mcp/sigma-core";

/**
 * Attack #5 — Cross-server credential reuse. A proof generated with one
 * server's identity baked into its challenge gets submitted against a
 * DIFFERENT, REAL, live MCP server, hoping the binding isn't actually
 * checked there. What should block it: serverId is baked into the sigma
 * challenge hash itself (H(R, publicKey, scope, nonce, serverId)) — a
 * proof signed for one server cannot satisfy the verification equation
 * when checked against another, this is pure algebra, not a lookup.
 *
 * This is tested against the REAL, live admin-mcp-server process over
 * real HTTP/MCP — not a simulated second serverId string.
 */
export async function attack5_crossServerReuse(): Promise<AttackResult> {
  const agent = await registerAgent("attacker-cross-server", { action: "delete_account" });

  // a REAL nonce, genuinely issued for admin-mcp-server
  const nonce = await getNonce("delete_account", "admin-mcp-server");

  // ATTACK: generate the proof as if it were for finance-mcp-server —
  // e.g. an attacker who captured a proof from a finance-mcp-server
  // transcript, hoping to replay it against the admin server instead
  const proof = generateProof(agent.secretKey, agent.publicKey, {
    scope: "delete_account",
    nonce,
    serverId: "finance-mcp-server", // WRONG — doesn't match the server we're calling
  });

  const mcpRes = await fetch(`${ADMIN_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "delete_account",
        arguments: {
          agentId: "attacker-cross-server",
          attestationId: agent.attestationId,
          requestedScope: { action: "delete_account" },
          sigmaProof: proof,
          nonce,
          accountRef: "acct-001",
        },
      },
    }),
  });

  const text = await mcpRes.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  const parsed = dataLine ? JSON.parse(dataLine.slice("data:".length).trim()) : null;
  const content = parsed?.result?.content?.[0]?.text;
  const resultBody = content ? JSON.parse(content) : null;

  const blocked = resultBody?.allowed === false;

  return {
    attack: "5: Cross-server credential reuse",
    blocked,
    reason: blocked
      ? `blocked correctly by the LIVE admin-mcp-server: ${resultBody.reason}`
      : `VULNERABLE: proof signed for finance-mcp-server was accepted by the real admin-mcp-server (${JSON.stringify(resultBody)})`,
  };
}