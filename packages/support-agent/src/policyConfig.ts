/**
 * The REAL registered policy parameters, per docs/policy-sources.md.
 * This agent needs these (as private circuit inputs) to generate a valid
 * compliance proof — per spec Stage 5: "Agent (or a compliance micro-
 * service holding the real transaction data) generates the Groth16 proof
 * ... using the real private inputs and the registered policy commitment."
 *
 * These values are infrastructure the agent's code holds — they are NEVER
 * shown to the LLM. The LLM only ever sees business-level tool results
 * (approved / escalate), never policy internals or proof machinery.
 */
export const POLICY = {
  policyLimit: 150,
  minAccountAgeDays: 30,
  maxPastRefundCount: 3,
  maxTransactionAgeDays: 120,
  policyLimitSalt: "48972134501928471234509182734",
};