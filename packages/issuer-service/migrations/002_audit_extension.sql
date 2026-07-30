-- issuer-service — Phase 4 addition
-- Extends audit_log to support unified two-proof audit entries written by
-- the gate (finance-mcp-server), per spec Stage 7: "Log entry stores:
-- timestamp, agentId, scope, both proof hashes, pass/fail, policy
-- commitment used."
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS proof2_hash TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tool_name TEXT;