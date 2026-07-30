-- Migration 002: Audit log columns for Attack 8 (intent-binding extension)
--
-- intent_binding_fail: true when the gate rejected a call because the
-- orderRef was not in the authenticated intent commitment — a distinct
-- event class from Proof 1 or Proof 2 failures. This produces the
-- second metric for the paper: attempted-vs-succeeded confused-deputy
-- rate, pre/post fix.
--
-- session_id: links each audit entry back to the originating ticket
-- session so pre/post attack-8 transcripts can be compared directly.

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS intent_binding_fail BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS session_id TEXT;
