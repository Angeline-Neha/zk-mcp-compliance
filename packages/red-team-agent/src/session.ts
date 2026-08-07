import {
  ISSUER_URL,
  FINANCE_URL,
  ADMIN_URL,
  registerAgent,
  getNonce,
  sigmaProof,
  verifyProof1,
  proveCompliance,
  circuitInput,
  randomSalt,
  realPolicyCommitment,
  POLICY,
} from "@zk-mcp/attack-scripts";
import { generateKeyPair } from "@zk-mcp/sigma-core";
import { buildPoseidon } from "circomlibjs";

interface Identity {
  secretKey: string;
  publicKey: string;
  attestationId?: string;
}

/**
 * Live state for a single red-team run. Every method here makes a real
 * network call against the actually-running issuer/finance/admin/proving
 * services — nothing is canned or pre-scripted. The LLM decides which of
 * these to call, in what order, and with what inputs.
 */
export class RedTeamSession {
  private identities = new Map<string, Identity>();

  private getIdentity(agentId: string): Identity {
    const id = this.identities.get(agentId);
    if (!id) throw new Error(`no identity for "${agentId}" — call register_attacker or delegate_scope first`);
    return id;
  }

  async register_attacker(args: { agentId: string; scope: { action: string; limit?: number } }) {
    const { agentId, scope } = args;
    const result = await registerAgent(agentId, scope);
    this.identities.set(agentId, {
      secretKey: result.secretKey,
      publicKey: result.publicKey,
      attestationId: result.attestationId,
    });
    return { attestationId: result.attestationId, publicKey: result.publicKey };
  }

  async delegate_scope(args: {
    parentAgentId: string;
    childAgentId: string;
    requestedScope: { action: string; limit?: number };
    expirySeconds?: number;
  }) {
    const parent = this.getIdentity(args.parentAgentId);
    if (!parent.attestationId) throw new Error(`${args.parentAgentId} has no attestation to delegate from`);

    const child = generateKeyPair();
    const res = await fetch(`${ISSUER_URL}/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentAttestationId: parent.attestationId,
        childAgentId: args.childAgentId,
        childPublicKey: child.publicKey,
        requestedScope: args.requestedScope,
        expirySeconds: args.expirySeconds ?? 3600,
      }),
    });
    const body = await res.json();
    if (res.ok) {
      this.identities.set(args.childAgentId, {
        secretKey: child.secretKey,
        publicKey: child.publicKey,
        attestationId: body.attestation.id,
      });
    }
    return { ok: res.ok, status: res.status, body };
  }

  async get_nonce(args: { scope: string; serverId: string }) {
    const nonce = await getNonce(args.scope, args.serverId);
    return { nonce };
  }

  async generate_proof(args: { agentId: string; scope: string; nonce: string; serverId: string }) {
    const id = this.getIdentity(args.agentId);
    const proof = await sigmaProof(id.secretKey, id.publicKey, {
      scope: args.scope,
      nonce: args.nonce,
      serverId: args.serverId,
    });
    return { proof, publicKey: id.publicKey };
  }

  async verify_proof1(args: {
    agentId: string;
    attestationId?: string;
    proof: { R: string; s: string };
    nonce: string;
    serverId: string;
    requestedScope: { action: string; limit?: number };
  }) {
    const id = this.identities.get(args.agentId);
    const attestationId = args.attestationId ?? id?.attestationId;
    if (!attestationId) throw new Error(`no attestationId available for ${args.agentId}`);
    return verifyProof1({
      attestationId,
      proof: args.proof,
      nonce: args.nonce,
      serverId: args.serverId,
      requestedScope: args.requestedScope,
    });
  }

  async revoke_attestation(args: { attestationId: string; reason: string }) {
    const res = await fetch(`${ISSUER_URL}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attestationId: args.attestationId, reason: args.reason }),
    });
    return { ok: res.ok, status: res.status, body: await res.json() };
  }

  async prove_compliance(args: {
    amount: number;
    accountAgeDays: number;
    pastRefundCount: number;
    transactionAgeDays: number;
    forgeFakePolicy?: boolean;
    fakePolicyLimit?: number;
  }) {
    const amountSalt = randomSalt();
    let policyCommitment: string;
    let policyLimit: number | undefined;

    if (args.forgeFakePolicy) {
      // ATTACK SURFACE: attempt to forge a self-consistent but fake
      // (policyLimit, commitment) pair, more lenient than the real registered one.
      const poseidon = await buildPoseidon();
      policyLimit = args.fakePolicyLimit ?? POLICY.policyLimit * 100;
      const hash = poseidon([
        policyLimit,
        POLICY.minAccountAgeDays,
        POLICY.maxPastRefundCount,
        POLICY.maxTransactionAgeDays,
        POLICY.policyLimitSalt,
      ]);
      policyCommitment = poseidon.F.toObject(hash).toString();
    } else {
      policyCommitment = await realPolicyCommitment();
    }

    const { status, body } = await proveCompliance(
      circuitInput({
        amount: args.amount,
        accountAgeDays: args.accountAgeDays,
        pastRefundCount: args.pastRefundCount,
        transactionAgeDays: args.transactionAgeDays,
        amountSalt,
        policyCommitment,
        policyLimit,
      })
    );

    return { status, body, amountSalt };
  }

  /**
   * Calls a real MCP tool (issue_refund, delete_account, lookup_order,
   * lookup_account) against the actually-running finance/admin server over
   * real JSON-RPC — this is the same path a legitimate agent uses, so a
   * successful call here is a genuine bypass, not a simulation.
   */
  async call_mcp_tool(args: {
    serverId: "finance-mcp-server" | "admin-mcp-server";
    toolName: string;
    arguments: Record<string, unknown>;
  }) {
    const base = args.serverId === "finance-mcp-server" ? FINANCE_URL : ADMIN_URL;
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: args.toolName, arguments: args.arguments },
      }),
    });
    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    const parsed = dataLine ? JSON.parse(dataLine.slice("data:".length).trim()) : JSON.parse(text);
    const content = parsed?.result?.content?.[0]?.text;
    const resultBody = content ? JSON.parse(content) : parsed;
    return { httpStatus: res.status, result: resultBody };
  }
}
