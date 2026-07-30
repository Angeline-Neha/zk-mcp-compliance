import type { InspectorSnapshot } from "../../lib/inspectorTypes";
import { Proof1Slip } from "./Proof1Slip";
import { Proof2LabReport } from "./Proof2LabReport";
import { Turnstile } from "./Turnstile";
import { monoStyle, stampStyle, FAIL, PASS } from "./styles";

interface Props {
  snapshot: InspectorSnapshot;
}

export function InspectorContent({ snapshot }: Props) {
  if (snapshot.partial || !snapshot.inspector) {
    return (
      <div style={{ opacity: 0.7 }}>
        <p style={stampStyle()}>Partial Record</p>
        <p style={{ ...monoStyle(9), marginTop: 8 }}>
          Full cryptographic detail unavailable for this entry.
          Only audit-log hashes were captured.
        </p>
        {snapshot.failReason && (
          <p style={{ ...monoStyle(9), marginTop: 8, color: FAIL }}>{snapshot.failReason}</p>
        )}
        {snapshot.proof1Hash && (
          <p style={{ ...monoStyle(8), marginTop: 8, color: "rgba(31,27,22,0.45)" }}>
            p1: {snapshot.proof1Hash.slice(0, 16)}…
          </p>
        )}
      </div>
    );
  }

  const { inspector } = snapshot;
  const proof1Passed = inspector.proof1.checks.algebra.ok;
  const hasIntent = !!inspector.intentCheck;
  const intentPassed = inspector.intentCheck?.ok ?? false;
  const proof2Reached = proof1Passed && (!hasIntent || intentPassed);

  return (
    <div>
      {/* Summary strip */}
      <div
        style={{
          marginBottom: 14,
          padding: "8px 10px",
          border: "1px solid rgba(31,27,22,0.12)",
          borderRadius: 2,
          background: "rgba(31,27,22,0.03)",
        }}
      >
        <p style={{ ...monoStyle(8), color: "rgba(31,27,22,0.45)" }}>
          {snapshot.agentId} · {snapshot.tool}
          {snapshot.orderRef ? ` · order ${snapshot.orderRef}` : ""}
        </p>
        <p
          style={{
            ...stampStyle(),
            marginTop: 4,
            color: snapshot.outcome === "pass" ? PASS : FAIL,
          }}
        >
          {snapshot.outcome === "pass" ? "VERIFIED" : "BLOCKED"}
        </p>
        {snapshot.failReason && (
          <p style={{ ...monoStyle(8), marginTop: 6, color: FAIL, lineHeight: 1.5 }}>
            {snapshot.failReason}
          </p>
        )}
      </div>

      <Proof1Slip proof1={inspector.proof1} />

      {hasIntent && (
        <Turnstile
          visible={proof1Passed || !inspector.proof1.checks.algebra.ok}
          ok={intentPassed}
          orderRef={inspector.intentCheck?.orderRef}
          message={inspector.intentCheck?.message ?? ""}
        />
      )}

      {inspector.proof2 && (
        <Proof2LabReport proof2={inspector.proof2} reached={proof2Reached} />
      )}
    </div>
  );
}
