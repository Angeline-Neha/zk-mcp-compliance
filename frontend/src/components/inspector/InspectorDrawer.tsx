import { InspectorContent } from "./InspectorContent";
import { monoStyle, stampStyle } from "./styles";

interface Props {
  open: boolean;
  onClose: () => void;
  requestId?: string;
  loading?: boolean;
  error?: string | null;
  snapshot?: import("../../lib/inspectorTypes").InspectorSnapshot | null;
  onVisualize?: () => void;
}

export function InspectorDrawer({
  open,
  onClose,
  requestId,
  loading,
  error,
  snapshot,
  onVisualize,
}: Props) {
  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(5,3,10,0.55)",
            zIndex: 40,
            cursor: "pointer",
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 36,
          right: 0,
          bottom: 0,
          width: 420,
          backgroundColor: "#0D0817",
          borderLeft: "1.5px solid rgba(233,228,242,0.15)",
          boxShadow: "-4px 0 24px rgba(233,228,242,0.12)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(217,169,74,0.2)",
            backgroundColor: "#170F26",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <p style={{ ...stampStyle(), color: "#D9A94A" }}>Inspector</p>
            {requestId && (
              <p style={{ ...monoStyle(8), color: "rgba(217,169,74,0.5)", marginTop: 2 }}>
                {requestId.length > 28 ? `${requestId.slice(0, 12)}…${requestId.slice(-8)}` : requestId}
              </p>
            )}
          </div>
          {onVisualize && requestId && !loading && !error && snapshot && (
            <button
              type="button"
              onClick={onVisualize}
              style={{
                marginLeft: "auto",
                ...monoStyle(9),
                color: "#D9A94A",
                background: "none",
                border: "1px solid rgba(217,169,74,0.4)",
                borderRadius: 2,
                padding: "2px 8px",
                cursor: "pointer",
              }}
            >
              VISUALIZE ▸
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: onVisualize && requestId && !loading && !error && snapshot ? 8 : "auto",
              ...monoStyle(9),
              color: "rgba(217,169,74,0.5)",
              background: "none",
              border: "1px solid rgba(217,169,74,0.2)",
              borderRadius: 2,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            CLOSE ✕
          </button>
        </div>

        <div className="scrollbar-paper" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading && (
            <p style={{ ...monoStyle(9), opacity: 0.5, paddingTop: 24, textAlign: "center" }}>
              Loading cryptographic trace<span className="cursor-blink" />
            </p>
          )}
          {error && !loading && (
            error === "inspector snapshot not found" ? (
              <div style={{ paddingTop: 24, textAlign: "center" }}>
                <p style={{ ...stampStyle(), opacity: 0.5 }}>NO SERVER TRACE</p>
                <p style={{ ...monoStyle(9), color: "rgba(233,228,242,0.5)", marginTop: 8, lineHeight: 1.6, padding: "0 12px" }}>
                  This attempt was rejected at Proof 1 — the sigma-protocol authorization
                  check — and never reached a real MCP server. There's no compliance
                  circuit, policy commitment, or inspector trace to show because the
                  request stopped before either was ever invoked.
                </p>
              </div>
            ) : (
              <p style={{ ...monoStyle(9), color: "#E15068", paddingTop: 24 }}>{error}</p>
            )
          )}
          {!loading && !error && snapshot && <InspectorContent snapshot={snapshot} />}
          {!loading && !error && !snapshot && open && (
            <p style={{ ...stampStyle(), opacity: 0.4, paddingTop: 40, textAlign: "center" }}>
              NO REQUEST SELECTED
            </p>
          )}
        </div>
      </div>
    </>
  );
}