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
            ? "rgba(131,153,88,0.18)"
            : status === "fail"
              ? "rgba(168,54,44,0.08)"
              : "rgba(10,51,35,0.04)";

        return (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && (
              <span style={{ ...monoStyle(11), color: "rgba(10,51,35,0.4)" }}>→</span>
            )}
            <div
              style={{
                ...monoStyle(11),
                padding: "4px 8px",
                border: `1.5px solid ${color}`,
                borderRadius: 4,
                backgroundColor: bg,
                color,
                letterSpacing: "0.05em",
                opacity: resolved ? 1 : 0.5,
                transform: resolved ? "scale(1)" : "scale(0.92)",
                boxShadow: "none",
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
    <p style={{ ...stampStyle(), fontSize: 12, marginTop: 12, color: "#5E2750" }}>
      Constraint graph
    </p>
  );
}
