/**
 * ExhibitsView — Phase 5: Nine Attack Exhibits
 *
 * Each panel corresponds to one attack definition in the backend
 * (packages/demo-gateway/src/attackSteps/). Panels are step-through
 * interactive: click "Run" → click "Step" through each stage → see BLOCKED.
 */
import { useState } from "react";
import { ExhibitPanel, ExhibitMeta } from "../components/exhibits/ExhibitPanel";

const EXHIBITS: ExhibitMeta[] = [
  {
    id: "1",
    number: "I",
    title: "Replay Attack",
    tagline: "Intercept a valid proof and resubmit it verbatim.",
    dangerVerb: "NONCE BURNED",
  },
  {
    id: "2",
    number: "II",
    title: "Confused Deputy",
    tagline: "Use a refund credential to attempt account deletion.",
    dangerVerb: "SCOPE MISMATCH",
  },
  {
    id: "3",
    number: "III",
    title: "Privilege Escalation",
    tagline: "Delegate more scope than you were ever granted.",
    dangerVerb: "LIMIT EXCEEDED",
  },
  {
    id: "4",
    number: "IV",
    title: "Lateral Movement",
    tagline: "Reach a tool whose attestation was never issued.",
    dangerVerb: "NO ATTESTATION",
  },
  {
    id: "5",
    number: "V",
    title: "Cross-Server Reuse",
    tagline: "Submit a proof minted for Server A to Server B.",
    dangerVerb: "SERVER MISMATCH",
  },
  {
    id: "6",
    number: "VI",
    title: "Revocation Race (TOCTOU)",
    tagline: "Revoke the agent while a proof is in flight.",
    dangerVerb: "REVOKED",
  },
  {
    id: "7",
    number: "VII",
    title: "Fake Compliance Proof",
    tagline: "Forge a self-consistent policy commitment with a raised limit.",
    dangerVerb: "COMMITMENT MISMATCH",
    params: [
      {
        key: "orderRef",
        label: "Target order",
        type: "orderRef",
        default: "1005",
        help: "Any real seeded order — the forgery is in the policy commitment, not the order.",
      },
      {
        key: "fakeLimit",
        label: "Forged policy limit ($)",
        type: "number",
        default: 999999,
        min: 1,
        help: "The real registered limit is $150. Any forged value here still gets caught — try changing it.",
      },
    ],
  },
  {
    id: "8",
    number: "VIII",
    title: "Prompt Injection (Intent Binding)",
    tagline: "Manipulate the LLM to target a different order than was committed.",
    dangerVerb: "INTENT BINDING FAIL",
    params: [
      {
        key: "legitOrderRef",
        label: "Really-authorized order",
        type: "orderRef",
        default: "1001",
        help: "The order the authenticated customer actually asked to refund.",
      },
      {
        key: "injectedOrderRef",
        label: "Injected (smuggled) order",
        type: "orderRef",
        default: "2001",
        help: "Pick a \"non-compliant\" order to see it caught twice over, or a \"compliant\" one to see intent-binding as the ONLY thing that stops it.",
      },
    ],
  },
  {
    id: "9",
    number: "IX",
    title: "Salami Slicing",
    tagline: "Repeat identical sub-limit refunds until cumulative damage exceeds the policy.",
    dangerVerb: "COUNT EXCEEDED",
    params: [
      {
        key: "orderRef",
        label: "Target order",
        type: "orderRef",
        category: "pass",
        default: "1005",
        help: "Pick a fresh compliant order — reusing one from an earlier run may already be out of refund budget.",
      },
    ],
  },
];

export function ExhibitsView() {
  const [activeId, setActiveId] = useState<string>("1");
  const activeExhibit = EXHIBITS.find((e) => e.id === activeId)!;

  return (
    <div className="exhibits-layout">
      {/* ── Left nav: exhibit index ── */}
      <nav className="exhibits-nav">
        <div className="exhibits-nav-header">
          <span className="font-stamp" style={{ fontSize: 11, letterSpacing: "0.18em", color: "#B23A2F" }}>
            CASE FILE
          </span>
          <br />
          <span className="font-stamp" style={{ fontSize: 9, letterSpacing: "0.12em", color: "#1F1B16", opacity: 0.5 }}>
            ATTACK EXHIBITS
          </span>
        </div>

        {EXHIBITS.map((ex) => (
          <button
            key={ex.id}
            className={`exhibit-nav-item ${activeId === ex.id ? "nav-item--active" : ""}`}
            onClick={() => setActiveId(ex.id)}
          >
            <span className="nav-item-number">{ex.number}</span>
            <span className="nav-item-title">{ex.title}</span>
          </button>
        ))}

        <div className="exhibits-nav-footer">
          <div className="nav-legend-row">
            <span className="legend-dot dot--blocked" />
            <span className="legend-label">Blocked</span>
          </div>
          <div className="nav-legend-row">
            <span className="legend-dot dot--pass" />
            <span className="legend-label">Passed</span>
          </div>
        </div>
      </nav>

      {/* ── Main exhibit canvas ── */}
      <main className="exhibits-canvas">
        <ExhibitPanel key={activeId} meta={activeExhibit} />
      </main>
    </div>
  );
}
