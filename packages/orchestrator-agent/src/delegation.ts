import { ISSUER_SERVICE_URL } from "./identity";

/**
 * Delegates a scoped attestation to support-agent's public key. This calls
 * the REAL /delegate endpoint on issuer-service, which enforces
 * childScope ⊆ parentScope server-side (see attestations.ts's
 * isSubsetScope) — orchestrator cannot delegate more than it holds, no
 * matter what it requests, since issuer-service checks against
 * orchestrator's ACTUAL registered attestation row, not orchestrator's claim.
 */
export async function delegateToSupportAgent(params: {
  orchestratorAttestationId: string;
  supportAgentPublicKey: string;
  requestedLimit: number;
}): Promise<{ attestationId: string; scopeLimit: number }> {
  const res = await fetch(`${ISSUER_SERVICE_URL}/delegate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentAttestationId: params.orchestratorAttestationId,
      childAgentId: "support-agent",
      childPublicKey: params.supportAgentPublicKey,
      requestedScope: { action: "issue_refund", limit: params.requestedLimit },
      expirySeconds: 300, // short-lived — scoped to this one ticket
    }),
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(`Delegation rejected: ${body.reason ?? body.error ?? res.statusText}`);
  }

  const { attestation } = await res.json();
  return { attestationId: attestation.id, scopeLimit: attestation.scope.limit };
}