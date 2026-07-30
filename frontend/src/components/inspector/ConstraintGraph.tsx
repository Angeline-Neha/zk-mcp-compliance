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
            ? "rgba(47,74,59,0.08)"
            : status === "fail"
              ? "rgba(178,58,47,0.08)"
              : "rgba(31,27,22,0.04)";

        return (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && (
              <span style={{ ...monoStyle(8), color: "rgba(31,27,22,0.25)" }}>→</span>
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
                transition: "opacity 0.15s, border-color 0.15s",
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
    <p style={{ ...stampStyle(), fontSize: 9, marginTop: 12, color: "rgba(176,141,87,0.7)" }}>
      Constraint graph
    </p>
  );
}
