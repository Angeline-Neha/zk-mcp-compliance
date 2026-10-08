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

const headerBtn = {
  font: "600 12px var(--zk-sans)",
  borderRadius: 6,
  padding: "5px 11px",
  cursor: "pointer",
} as const;

export function InspectorDrawer({
  open,
  onClose,
  requestId,
  loading,
  error,
  snapshot,
  onVisualize,
}: Props) {
  const canVisualize = !!(onVisualize && requestId && !loading && !error && snapshot);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(10,51,35,0.35)",
            zIndex: 40,
            cursor: "pointer",
          }}
        />
      )}

      <div
        className="zk-insp"
        style={{
          position: "fixed",
          top: 48,
          right: 0,
          bottom: 0,
          width: 440,
          maxWidth: "100%",
          backgroundColor: "#FCFBEA",
          borderLeft: "1.5px solid #0A3323",
          boxShadow: "-18px 0 40px -24px rgba(10,51,35,0.5)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--zk-sans)",
          color: "#0A3323",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--zk-rule)",
            backgroundColor: "#FCFBEA",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ ...stampStyle(), margin: 0 }}>Inspector</p>
            {requestId && (
              <p style={{ ...monoStyle(12), margin: "2px 0 0", opacity: 0.65 }}>
                {requestId.length > 28 ? `${requestId.slice(0, 12)}…${requestId.slice(-8)}` : requestId}
              </p>
            )}
          </div>
          {canVisualize && (
            <button
              type="button"
              onClick={onVisualize}
              style={{ ...headerBtn, marginLeft: "auto", color: "#fff", background: "#5E2750", border: "1px solid #5E2750" }}
            >
              Visualize on board
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            style={{
              ...headerBtn,
              marginLeft: canVisualize ? 0 : "auto",
              color: "#0A3323",
              background: "rgba(10,51,35,0.08)",
              border: 0,
            }}
          >
            Close
          </button>
        </div>

        <div className="scrollbar-paper" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading && (
            <p style={{ ...monoStyle(12), opacity: 0.6, paddingTop: 24, textAlign: "center" }}>
              Loading cryptographic trace<span className="cursor-blink" />
            </p>
          )}
          {error && !loading && (
            error === "inspector snapshot not found" ? (
              <div style={{ paddingTop: 24, textAlign: "center" }}>
                <p style={{ ...stampStyle(), opacity: 0.7 }}>No server trace</p>
                <p style={{ ...monoStyle(12), opacity: 0.7, marginTop: 8, lineHeight: 1.6, padding: "0 12px" }}>
                  This attempt was rejected at Proof 1 — the sigma-protocol authorization
                  check — and never reached a real MCP server. There's no compliance
                  circuit, policy commitment, or inspector trace to show because the
                  request stopped before either was ever invoked.
                </p>
              </div>
            ) : (
              <p style={{ ...monoStyle(12), color: "#A8362C", paddingTop: 24 }}>{error}</p>
            )
          )}
          {!loading && !error && snapshot && <InspectorContent snapshot={snapshot} />}
          {!loading && !error && !snapshot && open && (
            <p style={{ ...stampStyle(), opacity: 0.5, paddingTop: 40, textAlign: "center" }}>
              No request selected
            </p>
          )}
        </div>
      </div>
    </>
  );
}
