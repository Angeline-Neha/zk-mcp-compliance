/**
 * The REAL registered deletion policy parameters, per docs/policy-
 * sources.md — ZK-MCP Reference Deletion Policy v1. Held by this agent's
 * code as trusted infrastructure, never shown to the LLM (same rationale
 * as support-agent's policyConfig.ts).
 */
export const POLICY = {
  retentionFloorDays: 2555, // 7 years, cited US financial-recordkeeping convention
  policyLimitSalt: "77123409128374091827340918273",
};