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
  // Tracks nonces/proofs that were GENUINELY returned by a real get_nonce /
  // generate_proof call this run. Used to catch the LLM inventing placeholder
  // values (e.g. "nonce_123456", { R: "ProofR", s: "Proofs" }) before they're
  // sent to the real server — a fabricated value failing schema/format
  // validation is a caller error, not a demonstration of the gate's actual
  // cryptographic defenses, and silently forwarding it produces a false
  // "BLOCKED" verdict for the wrong reason.
  private knownNonces = new Set<string>();
  private knownProofs = new Set<string>(); // keyed as `${R}:${s}`

  private getIdentity(agentId: string): Identity {
    const id = this.identities.get(agentId);
    if (!id) throw new Error(`no identity for "${agentId}" — call register_attacker or delegate_scope first`);
    return id;
  }

  private assertRealNonce(nonce: string) {
    if (!this.knownNonces.has(nonce)) {
      throw new Error(
        `REJECTED BEFORE REACHING THE SERVER: nonce "${nonce}" was never returned by a real get_nonce call in ` +
        `this session — it looks invented. You must pass the EXACT nonce string from a prior get_nonce response, ` +
        `not a placeholder. This is a caller error, not the gate defending itself — it proves nothing about the ` +
        `attack. Call get_nonce again if you no longer have the real value, then retry with it verbatim.`
      );
    }
  }

  private assertRealProof(proof: { R: string; s: string }) {
    const key = `${proof.R}:${proof.s}`;
    if (!this.knownProofs.has(key)) {
      throw new Error(
        `REJECTED BEFORE REACHING THE SERVER: the proof { R: "${proof.R}", s: "${proof.s}" } was never returned ` +
        `by a real generate_proof call in this session — it looks invented. You must pass the EXACT {R, s} object ` +
        `from a prior generate_proof response, not a placeholder. This is a caller error, not the gate defending ` +
        `itself. Call generate_proof again if you no longer have the real value, then retry with it verbatim.`
      );
    }
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
    this.knownNonces.add(nonce);
    return { nonce };
  }

  async generate_proof(args: { agentId: string; scope: string; nonce: string; serverId: string }) {
    this.assertRealNonce(args.nonce);
    const id = this.getIdentity(args.agentId);
    const proof = await sigmaProof(id.secretKey, id.publicKey, {
      scope: args.scope,
      nonce: args.nonce,
      serverId: args.serverId,
    });
    this.knownProofs.add(`${proof.R}:${proof.s}`);
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
    this.assertRealNonce(args.nonce);
    this.assertRealProof(args.proof);
    const id = this.identities.get(args.agentId);
    // attestationId is intentionally NOT validated against known identities —
    // objective 4 (lateral movement) specifically requires being able to pass
    // a fabricated attestationId to test that the server has no attestation
    // to find, so fabrication here is a legitimate part of the attack.
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

  async call_mcp_tool(args: {
    serverId: "finance-mcp-server" | "admin-mcp-server";
    toolName: string;
    arguments: Record<string, unknown>;
  }) {
    // Same fabrication check as verify_proof1, applied only when these
    // fields are actually present — read-only tools like lookup_order /
    // lookup_account don't carry a nonce or sigmaProof at all.
    if (typeof args.arguments?.nonce === "string") {
      this.assertRealNonce(args.arguments.nonce as string);
    }
    const sigmaProofArg = args.arguments?.sigmaProof as { R?: string; s?: string } | undefined;
    if (sigmaProofArg && typeof sigmaProofArg.R === "string" && typeof sigmaProofArg.s === "string") {
      this.assertRealProof(sigmaProofArg as { R: string; s: string });
    }

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

    // The MCP server may reply with SSE ("data: {...}") or plain JSON.
    // Safely parse whichever form arrives.
    let parsed: any;
    try {
      const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
      parsed = dataLine
        ? JSON.parse(dataLine.slice("data:".length).trim())
        : JSON.parse(text);
    } catch {
      // Raw text response (e.g. "MCP error ..." from the SDK) — wrap it so
      // the LLM can read it and inferBlocked can treat it as a gate rejection.
      return { httpStatus: res.status, result: { error: text.trim() } };
    }

    // MCP tool results embed their payload in result.content[0].text as a
    // JSON string. Safely parse that inner layer too.
    const content = parsed?.result?.content?.[0]?.text;
    let resultBody: any;
    try {
      resultBody = content ? JSON.parse(content) : parsed;
    } catch {
      // content was a plain string (e.g. MCP error message), not JSON.
      resultBody = content ? { error: content } : parsed;
    }

    // MCP isError flag: a tool returning isError:true means the gate blocked it.
    if (parsed?.result?.isError) {
      return { httpStatus: res.status, result: { error: resultBody, isError: true } };
    }

    return { httpStatus: res.status, result: resultBody };
  }
}