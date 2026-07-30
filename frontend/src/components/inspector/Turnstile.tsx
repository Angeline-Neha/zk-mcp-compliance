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
        borderRadius: 3,
        background: ok ? "rgba(47,74,59,0.06)" : "rgba(178,58,47,0.06)",
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
      <p style={{ ...stampStyle(), fontSize: 9, color }}>Turnstile — Intent Checkpoint</p>
      <p style={{ ...monoStyle(9), marginTop: 6, color }}>
        {ok ? (
          <>
            <span style={{ color: PASS }}>OPEN</span>
            {" · "}
            {orderRef ? `"${orderRef}" ∈ authenticated intent` : message}
          </>
        ) : (
          <>
            <span style={{ color: FAIL }}>SHUT</span>
            {" · "}
            {message}
          </>
        )}
      </p>
    </div>
  );
}
