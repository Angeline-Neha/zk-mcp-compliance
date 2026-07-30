import { useMemo } from "react";
import { FAIL, PASS } from "./styles";

interface Props {
  R: string;
  s: string;
  c: string;
  publicKey: string;
  algebraOk: boolean;
  expanded: boolean;
  onToggle: () => void;
}

/** Map field element hex → canvas coordinate (mod-down for plottability). */
function fieldToCoord(hex: string, max: number): number {
  try {
    const n = BigInt("0x" + hex.replace(/^0x/i, "").slice(0, 16));
    return Number(n % BigInt(max - 20)) + 10;
  } catch {
    return max / 2;
  }
}

export function EllipticCurvePlot({ R, s, c, publicKey, algebraOk, expanded, onToggle }: Props) {
  const size = 120;

  const { sgX, sgY, rcP_X, rcP_Y } = useMemo(() => {
    const baseX = fieldToCoord(R, size);
    const baseY = fieldToCoord(s, size);
    const sgX = fieldToCoord(c + s, size);
    const sgY = fieldToCoord(c + publicKey, size);
    const offset = algebraOk ? 0 : 18;
    return {
      sgX,
      sgY,
      rcP_X: baseX + offset,
      rcP_Y: baseY + offset,
    };
  }, [R, s, c, publicKey, algebraOk]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        style={{
          marginTop: 8,
          fontFamily: "'Archivo', sans-serif",
          fontSize: 9,
          color: "#B08D57",
          background: "none",
          border: "none",
          cursor: "pointer",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        ▸ show curve
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          fontFamily: "'Archivo', sans-serif",
          fontSize: 9,
          color: "#B08D57",
          background: "none",
          border: "none",
          cursor: "pointer",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        ▾ hide curve
      </button>
      <svg
        width={size}
        height={size}
        style={{
          border: "1px solid rgba(31,27,22,0.15)",
          borderRadius: 2,
          background: "rgba(31,27,22,0.03)",
        }}
      >
        {/* faint grid */}
        {[30, 60, 90].map((n) => (
          <g key={n} opacity={0.15}>
            <line x1={n} y1={0} x2={n} y2={size} stroke="#1F1B16" strokeWidth={0.5} />
            <line x1={0} y1={n} x2={size} y2={n} stroke="#1F1B16" strokeWidth={0.5} />
          </g>
        ))}

        {/* s·G */}
        <circle
          cx={sgX}
          cy={sgY}
          r={5}
          fill={algebraOk ? PASS : FAIL}
          opacity={0.85}
          style={{
            transition: algebraOk ? undefined : "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        />
        <text x={sgX + 7} y={sgY + 3} fontSize={7} fill={PASS} fontFamily="JetBrains Mono">
          s·G
        </text>

        {/* R + c·P */}
        <circle cx={rcP_X} cy={rcP_Y} r={5} fill={algebraOk ? PASS : FAIL} opacity={0.85} />
        <text x={rcP_X + 7} y={rcP_Y + 3} fontSize={7} fill={algebraOk ? PASS : FAIL} fontFamily="JetBrains Mono">
          R+c·P
        </text>
      </svg>
    </div>
  );
}
