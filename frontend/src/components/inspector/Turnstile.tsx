import { PASS, FAIL, monoStyle, stampStyle } from "./styles";

interface Props {
  ok: boolean;
  orderRef?: string;
  message: string;
  visible: boolean;
}

export function Turnstile({ ok, orderRef, message, visible }: Props) {
  if (!visible) return null;

  const color = ok ? PASS : FAIL;

  return (
    <div
      style={{
        margin: "14px 0",
        padding: "10px 12px",
        border: `2px solid ${color}`,
        borderRadius: 8,
        background: ok ? "rgba(131,153,88,0.14)" : "rgba(168,54,44,0.08)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -1,
          top: "50%",
          transform: "translateY(-50%)",
          width: 6,
          height: 28,
          background: color,
          borderRadius: "0 2px 2px 0",
        }}
      />
      <p style={{ ...stampStyle(), fontSize: 12, color }}>Intent check</p>
      <p style={{ ...monoStyle(12), marginTop: 6, color }}>
        {ok ? (
          <>
            <span style={{ color: PASS }}>PASS</span>
            {" · "}
            {orderRef ? `"${orderRef}" ∈ authenticated intent` : message}
          </>
        ) : (
          <>
            <span style={{ color: FAIL }}>BLOCK</span>
            {" · "}
            {message}
          </>
        )}
      </p>
    </div>
  );
}
