import { monoStyle, stampStyle, statusColor } from "./styles";

interface Constraint {
  name: string;
  ok: boolean;
}

interface Props {
  constraints: Constraint[];
  resolvedCount: number;
}

export function ConstraintGraph({ constraints, resolvedCount }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
        marginTop: 10,
      }}
    >
      {constraints.map((c, i) => {
        const resolved = resolvedCount > i;
        const status = !resolved ? "pending" : c.ok ? "pass" : "fail";
        const color = statusColor(status);
        const bg =
          status === "pass"
            ? "rgba(84,201,154,0.08)"
            : status === "fail"
              ? "rgba(225,80,104,0.08)"
              : "rgba(233,228,242,0.04)";

        return (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && (
              <span style={{ ...monoStyle(8), color: "rgba(233,228,242,0.25)" }}>→</span>
            )}
            <div
              style={{
                ...monoStyle(8),
                padding: "4px 8px",
                border: `1.5px solid ${color}`,
                borderRadius: 2,
                backgroundColor: bg,
                color,
                letterSpacing: "0.05em",
                opacity: resolved ? 1 : 0.5,
                transform: resolved ? "scale(1)" : "scale(0.92)",
                boxShadow: resolved && status !== "pending" ? `0 0 8px ${status === "pass" ? "rgba(84,201,154,0.25)" : "rgba(225,80,104,0.25)"}` : "none",
                transition: "opacity 0.2s, border-color 0.2s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s",
              }}
            >
              [{c.name}]
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ConstraintGraphHeader() {
  return (
    <p style={{ ...stampStyle(), fontSize: 9, marginTop: 12, color: "rgba(217,169,74,0.7)" }}>
      Constraint graph
    </p>
  );
}
