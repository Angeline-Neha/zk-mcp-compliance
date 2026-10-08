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
      style={{
        padding: "14px 16px",
        marginBottom: 12,
        background: "#FFFFFF",
        border: "1px solid var(--zk-rule)",
        borderRadius: 8,
      }}
    >
      <p style={stampStyle()}>Proof 2 · Groth16 policy</p>

      <pre
        style={{
          ...monoStyle(12),
          marginTop: 10,
          whiteSpace: "pre-wrap",
          color: "rgba(10,51,35,0.85)",
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
        <p style={{ ...monoStyle(12), marginTop: 10 }}>
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
          <p style={{ ...monoStyle(12), marginTop: 4 }}>
            proof size: {proof2.proofSizeBytes} bytes
          </p>
          <p style={{ ...monoStyle(12), marginTop: 4, color: proof2.approved ? PASS : FAIL }}>
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
        <p style={{ ...monoStyle(12), marginTop: 10, color: "rgba(10,51,35,0.5)" }}>
          Awaiting: Proof 1 must pass first
        </p>
      )}
    </div>
  );
}

function SealedField({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
      <span style={{ ...monoStyle(11), color: "rgba(10,51,35,0.55)", width: 110 }}>{label}</span>
      <span
        style={{
          ...monoStyle(12),
          letterSpacing: 2,
          color: active ? "#D3968C" : "rgba(247,244,213,0.45)",
          background: "#0A3323",
          padding: "1px 4px",
          borderRadius: 2,
          opacity: active ? undefined : 0.7,
          animation: active ? "pulse-seal 2.5s ease-in-out infinite" : undefined,
        }}
      >
        ▓▓▓▓▓▓▓▓
      </span>
    </div>
  );
}
