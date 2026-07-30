import { useState, useEffect } from "react";
import type { InspectorDetail } from "../../lib/inspectorTypes";
import { ConstraintGraph, ConstraintGraphHeader } from "./ConstraintGraph";
import { monoStyle, stampStyle, FAIL, PASS } from "./styles";

interface Props {
  proof2: NonNullable<InspectorDetail["proof2"]>;
  reached: boolean;
}

export function Proof2LabReport({ proof2, reached }: Props) {
  const [resolvedConstraints, setResolvedConstraints] = useState(0);
  const [showProving, setShowProving] = useState(false);
  const [provingDone, setProvingDone] = useState(false);

  useEffect(() => {
    if (!reached) {
      setResolvedConstraints(0);
      setShowProving(false);
      setProvingDone(false);
      return;
    }

    setShowProving(true);
    const t1 = setTimeout(() => setProvingDone(true), Math.min(proof2.timingMs, 800));
    const timers: ReturnType<typeof setTimeout>[] = [t1];

    proof2.constraints.forEach((_, i) => {
      timers.push(
        setTimeout(() => setResolvedConstraints(i + 1), 200 + i * 120)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [reached, proof2.timingMs, proof2.constraints.length]);

  const circuitLabel = proof2.circuitId.includes(".")
    ? proof2.circuitId
    : `${proof2.circuitId}.circom`;

  return (
    <div
      className="case-card"
      style={{
        padding: "12px 14px",
        marginBottom: 12,
        background: "rgba(20,17,14,0.04)",
      }}
    >
      <p style={stampStyle()}>Proof 2 — Lab Report</p>

      <pre
        style={{
          ...monoStyle(9),
          marginTop: 10,
          whiteSpace: "pre-wrap",
          color: "rgba(31,27,22,0.75)",
        }}
      >
{`CIRCUIT: ${circuitLabel}
─────────────────────────────
private inputs        [sealed — 3 fields]
  amount              ▓▓▓▓▓▓▓▓
  accountAgeDays      ▓▓▓▓▓▓▓▓
  pastRefundCount     ▓▓▓▓▓▓▓▓
public inputs
  policyCommitment    ${proof2.policyCommitment?.slice(0, 8) ?? "—"}…
  toolScope           ${proof2.toolScope}
─────────────────────────────`}
      </pre>

      <div style={{ marginTop: 8 }}>
        <SealedField label="amount" active={reached && !provingDone} />
        <SealedField label="accountAgeDays" active={reached && !provingDone} />
        <SealedField label="pastRefundCount" active={reached && !provingDone} />
      </div>

      {reached && showProving && (
        <p style={{ ...monoStyle(9), marginTop: 10 }}>
          proving…{" "}
          {provingDone ? (
            <span style={{ color: PASS }}>⏱ {proof2.timingMs}ms</span>
          ) : (
            <span className="cursor-blink" />
          )}
        </p>
      )}

      {reached && provingDone && (
        <>
          <p style={{ ...monoStyle(9), marginTop: 4 }}>
            proof size: {proof2.proofSizeBytes} bytes
          </p>
          <p style={{ ...monoStyle(9), marginTop: 4, color: proof2.approved ? PASS : FAIL }}>
            approved:{"   "}
            {proof2.approved ? "true" : "false"}
          </p>

          <ConstraintGraphHeader />
          <ConstraintGraph
            constraints={proof2.constraints}
            resolvedCount={resolvedConstraints}
          />
        </>
      )}

      {!reached && (
        <p style={{ ...monoStyle(9), marginTop: 10, color: "rgba(31,27,22,0.35)" }}>
          AWAITING — Proof 1 must pass first
        </p>
      )}
    </div>
  );
}

function SealedField({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
      <span style={{ ...monoStyle(8), color: "rgba(31,27,22,0.4)", width: 110 }}>{label}</span>
      <span
        style={{
          ...monoStyle(9),
          letterSpacing: 2,
          color: "#14110E",
          opacity: active ? undefined : 0.6,
          animation: active ? "pulse-seal 2.5s ease-in-out infinite" : undefined,
        }}
      >
        ▓▓▓▓▓▓▓▓
      </span>
    </div>
  );
}
