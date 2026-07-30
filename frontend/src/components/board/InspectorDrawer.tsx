interface Props {
  open: boolean;
  onClose: () => void;
  requestId?: string;
  children?: React.ReactNode;
}

export function InspectorDrawer({ open, onClose, requestId, children }: Props) {
  return (
    <>
      {/* Board dim overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(237,230,214,0.5)',
            backdropFilter: 'blur(1px)',
            zIndex: 20,
            cursor: 'pointer',
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          backgroundColor: '#EDE6D6',
          borderLeft: '1.5px solid rgba(31,27,22,0.15)',
          boxShadow: '-4px 0 24px rgba(31,27,22,0.12)',
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(31,27,22,0.1)',
            backgroundColor: '#1F1B16',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'Special Elite', serif",
                fontSize: 10,
                color: '#B08D57',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              INSPECTOR
            </p>
            {requestId && (
              <p
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: 'rgba(176,141,87,0.5)',
                  marginTop: 2,
                }}
              >
                {requestId}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: 'rgba(176,141,87,0.5)',
              background: 'none',
              border: '1px solid rgba(176,141,87,0.2)',
              borderRadius: 2,
              padding: '2px 8px',
              cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            CLOSE ✕
          </button>
        </div>

        {/* Drawer content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
          }}
          className="scrollbar-paper"
        >
          {children ?? <InspectorPlaceholder />}
        </div>
      </div>
    </>
  );
}

function InspectorPlaceholder() {
  return (
    <div style={{ opacity: 0.4, paddingTop: 40, textAlign: 'center' }}>
      <p
        style={{
          fontFamily: "'Special Elite', serif",
          fontSize: 16,
          color: '#1F1B16',
          letterSpacing: '0.1em',
        }}
      >
        NO REQUEST SELECTED
      </p>
      <p
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: '#1F1B16',
          marginTop: 8,
          lineHeight: 1.6,
        }}
      >
        Click a node or docket entry to<br />inspect its cryptographic trace.
      </p>
      <div
        style={{
          marginTop: 24,
          padding: '12px 16px',
          border: '1.5px dashed rgba(31,27,22,0.2)',
          borderRadius: 3,
          textAlign: 'left',
        }}
      >
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(31,27,22,0.35)', lineHeight: 2 }}>
          SIGMA PROOF — verifying<br />
          R  = 03a0...f440<br />
          s  = 76f6...5c8<br />
          c  = H(R, P, scope, nonce)<br />
          ─────────────────────<br />
          Proof 1  ■■■■■■■■ AWAITING<br />
          Intent   ■■■■■■■■ AWAITING<br />
          Proof 2  ■■■■■■■■ AWAITING
        </p>
      </div>
      <p
        style={{
          marginTop: 12,
          fontFamily: "'Archivo', sans-serif",
          fontSize: 8,
          color: 'rgba(31,27,22,0.3)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Full detail available in Phase 4
      </p>
    </div>
  );
}
