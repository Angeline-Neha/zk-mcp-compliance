import { useState, useEffect } from "react";
import type { InspectorProof1 } from "../../lib/inspectorTypes";
import { checkStatus } from "../../lib/inspectorTypes";
import { EllipticCurvePlot } from "./EllipticCurvePlot";
import { monoStyle, stampStyle, statusColor, truncateHex } from "./styles";

interface Props {
  proof1: InspectorProof1;
}

const CHECK_ORDER = ["algebra", "nonce", "scope", "revocation"] as const;

const CHECK_LABELS: Record<(typeof CHECK_ORDER)[number], string> = {
  algebra: "s·G == R + c·P",
  nonce: "nonce",
  scope: "scope",
  revocation: "revoc",
};

export function Proof1Slip({ proof1 }: Props) {
  const [resolvedCount, setResolvedCount] = useState(0);
  const [curveOpen, setCurveOpen] = useState(false);

  useEffect(() => {
    setResolvedCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < CHECK_ORDER.length; i++) {
      timers.push(setTimeout(() => setResolvedCount(i + 1), 100 + i * 110));
    }
    return () => timers.forEach(clearTimeout);
  }, [proof1.R, proof1.s]);


  return (
    <div
      className="case-card"
      style={{ padding: "12px 14px", marginBottom: 12 }}
    >
      <p style={stampStyle()}>Proof 1 — Evidence Slip</p>
      <p style={{ ...monoStyle(8), color: "rgba(31,27,22,0.45)", marginTop: 4 }}>
        SIGMA / Schnorr · secp256k1
      </p>

      <div style={{ marginTop: 10, ...monoStyle(9) }}>
        <Row label="R" value={truncateHex(proof1.R, 10, 8)} />
        <Row label="s" value={truncateHex(proof1.s, 10, 8)} />
        <Row label="c" value={truncateHex(proof1.c, 10, 8)} />
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid rgba(31,27,22,0.1)", paddingTop: 10 }}>
        {CHECK_ORDER.map((key, idx) => {
          const resolved = resolvedCount > idx;
          const check = proof1.checks[key];
          const status = checkStatus(check.ok, resolved);
          const color = statusColor(status);

          let line = check.detail;
          if (key === "scope" && resolved) {
            line = `"${proof1.scope}" matches`;
          }
          if (key === "nonce" && resolved && "ttlMs" in check && check.ttlMs != null) {
            line = `unburned, TTL ${Math.round(check.ttlMs / 1000)}s remaining`;
          }

          return (
            <div
              key={key}
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 6,
                alignItems: "flex-start",
              }}
            >
              <span style={{ ...monoStyle(8), color: "rgba(31,27,22,0.35)", width: 52, flexShrink: 0 }}>
                {CHECK_LABELS[key]}
              </span>
              <span style={{ ...monoStyle(9), color, flex: 1 }}>
                {resolved ? line : <span className="cursor-blink" />}
              </span>
            </div>
          );
        })}
      </div>

      <EllipticCurvePlot
        R={proof1.R}
        s={proof1.s}
        c={proof1.c}
        publicKey={proof1.publicKey}
        algebraOk={proof1.checks.algebra.ok}
        expanded={curveOpen}
        onToggle={() => setCurveOpen((v) => !v)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 3 }}>
      <span style={{ color: "rgba(31,27,22,0.4)", width: 14 }}>{label}</span>
      <span style={{ wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
