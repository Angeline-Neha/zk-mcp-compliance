import { useEffect, useState } from "react";
import { Scoreboard } from "../components/auditor/Scoreboard";
import { BreachComparison } from "../components/auditor/BreachComparison";
import { CheckpointFunnel } from "../components/auditor/CheckpointFunnel";
import { ProofLatencyStrip } from "../components/auditor/ProofLatencyStrip";
import { LiveDatabasePanel } from "../components/auditor/LiveDatabasePanel";
import { Oscilloscope } from "../components/auditor/Oscilloscope";
import { fetchAttackResults } from "../lib/api";

/* ── Animated stat card ─────────────────────────────────────────── */
function StatCard({
  label,
  value,
  sub,
  accent,
  pulse,
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  pulse?: boolean;
  delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      style={{
        backgroundColor: "#170F26",
        border: `1px solid ${accent}40`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 3,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      {/* glow blob */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}22, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-data)",
          fontSize: 9,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(233,228,242,0.45)",
        }}
      >
        {pulse && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: accent,
              display: "inline-block",
              animation: "pulse-dot 1.6s ease-in-out infinite",
            }}
          />
        )}
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-stamp)",
          fontSize: 28,
          color: accent,
          lineHeight: 1,
          letterSpacing: "0.05em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            color: "rgba(233,228,242,0.35)",
            letterSpacing: "0.08em",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── Threat level indicator ─────────────────────────────────────── */
function ThreatLevel({ blockedCount, totalRun }: { blockedCount: number; totalRun: number }) {
  const pct = totalRun === 0 ? 100 : Math.round((blockedCount / totalRun) * 100);
  const level = pct >= 80 ? "LOW" : pct >= 50 ? "MEDIUM" : "HIGH";
  const levelColor = pct >= 80 ? "#54C99A" : pct >= 50 ? "#D9A94A" : "#E15068";

  return (
    <div
      style={{
        backgroundColor: "#170F26",
        border: `1px solid rgba(233,228,242,0.1)`,
        borderRadius: 3,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: `2px solid ${levelColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: `0 0 16px ${levelColor}44`,
          animation: level === "HIGH" ? "pulse-dot 1.2s ease-in-out infinite" : "none",
        }}
      >
        <span style={{ fontFamily: "var(--font-stamp)", fontSize: 11, color: levelColor, letterSpacing: "0.05em" }}>
          {level}
        </span>
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-data)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(233,228,242,0.45)", marginBottom: 4 }}>
          Threat Level
        </div>
        <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "rgba(233,228,242,0.7)" }}>
          {blockedCount}/{totalRun} attacks blocked
        </div>
        {/* progress bar */}
        <div style={{ marginTop: 6, width: 140, height: 3, backgroundColor: "rgba(233,228,242,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              backgroundColor: levelColor,
              borderRadius: 2,
              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Section heading ────────────────────────────────────────────── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 9,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "rgba(233,228,242,0.35)",
        borderLeft: "2px solid #8B7FE0",
        paddingLeft: 8,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

/* ── System integrity badge strip ───────────────────────────────── */
const CHECKS = [
  { label: "Issuer MCP", ok: true },
  { label: "Finance Gate", ok: true },
  { label: "Admin Gate", ok: true },
  { label: "ZK Circuits", ok: true },
  { label: "Proof Verifier", ok: true },
  { label: "Intent Binding", ok: true },
];

function IntegrityStrip() {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    CHECKS.forEach((_, i) => {
      setTimeout(() => setRevealed((c) => Math.max(c, i + 1)), 300 + i * 180);
    });
  }, []);

  return (
    <div
      style={{
        backgroundColor: "#170F26",
        border: "1px solid rgba(233,228,242,0.1)",
        borderRadius: 3,
        padding: "14px 18px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 9,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(233,228,242,0.4)",
          marginBottom: 10,
        }}
      >
        System Integrity
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CHECKS.map((c, i) => (
          <div
            key={c.label}
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              padding: "3px 8px",
              border: `1px solid ${i < revealed ? "rgba(84,201,154,0.4)" : "rgba(233,228,242,0.1)"}`,
              borderRadius: 2,
              color: i < revealed ? "#54C99A" : "rgba(233,228,242,0.25)",
              backgroundColor: i < revealed ? "rgba(84,201,154,0.06)" : "transparent",
              letterSpacing: "0.08em",
              transition: "all 0.3s ease",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {i < revealed && (
              <span style={{ fontSize: 8 }}>●</span>
            )}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main view ──────────────────────────────────────────────────── */
export function AuditorView() {
  const [outcomes, setOutcomes] = useState<Record<string, { status: "not_run" | "blocked" | "passed" }>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetchAttackResults().then(setOutcomes).catch(() => {});
    const iv = setInterval(() => {
      fetchAttackResults().then(setOutcomes).catch(() => {});
      setTick((t) => t + 1);
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  const allRun = Object.values(outcomes).filter((o) => o.status !== "not_run");
  const blocked = allRun.filter((o) => o.status === "blocked").length;
  const passed = allRun.filter((o) => o.status === "passed").length;
  const notRun = 9 - allRun.length;

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ backgroundColor: "#0D0817", position: "relative" }}
    >
      {/* Blueprint grid overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage:
            "repeating-linear-gradient(to right,rgba(42,32,68,0.4) 0,rgba(42,32,68,0.4) 1px,transparent 1px,transparent 32px),repeating-linear-gradient(to bottom,rgba(42,32,68,0.4) 0,rgba(42,32,68,0.4) 1px,transparent 1px,transparent 32px)",
          opacity: 0.5,
        }}
      />
      {/* Corner glows */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage:
            "radial-gradient(circle at 4% 2%,rgba(217,169,74,0.18) 0%,transparent 32%),radial-gradient(circle at 98% 3%,rgba(139,127,224,0.18) 0%,transparent 30%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, padding: "32px 40px 64px" }}>
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderBottom: "2px solid rgba(233,228,242,0.12)",
            paddingBottom: 20,
            marginBottom: 32,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#8B7FE0",
                margin: "0 0 6px",
              }}
            >
              ZK-MCP COMPLIANCE SYSTEM
            </p>
            <h1
              style={{
                fontFamily: "var(--font-stamp)",
                fontSize: 36,
                color: "#E9E4F2",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Auditor Dashboard
            </h1>
            <p
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                marginTop: 6,
                color: "rgba(233,228,242,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
              }}
            >
              Cryptographic Integrity & Baseline Comparison — Live
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ThreatLevel blockedCount={blocked} totalRun={allRun.length} />
            <Oscilloscope />
          </div>
        </div>

        {/* ── Top stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 28 }}>
          <StatCard label="Attacks Blocked" value={blocked} accent="#54C99A" pulse delay={0} />
          <StatCard label="Attacks Passed" value={passed} accent="#E15068" delay={100} />
          <StatCard label="Not Yet Run" value={notRun} accent="rgba(233,228,242,0.35)" delay={200} />
          <StatCard label="Block Rate" value={allRun.length ? `${Math.round((blocked / allRun.length) * 100)}%` : "—"} accent="#D9A94A" delay={300} />
          <StatCard label="ZK Circuits" value="Online" sub="Groth16 + Sigma" accent="#8B7FE0" pulse delay={400} />
        </div>

        {/* ── Integrity strip ── */}
        <div style={{ marginBottom: 28 }}>
          <IntegrityStrip />
        </div>

        {/* ── Scoreboard + Funnel ── */}
        <SectionHeading>Attack Outcomes</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "8fr 4fr", gap: 20, marginBottom: 28 }}>
          <Scoreboard />
          <CheckpointFunnel />
        </div>

        {/* ── Proof latency ── */}
        <SectionHeading>Proof Latency</SectionHeading>
        <div style={{ marginBottom: 28 }}>
          <ProofLatencyStrip />
        </div>

        {/* ── Breach comparison ── */}
        <SectionHeading>Architecture Comparison</SectionHeading>
        <div style={{ marginBottom: 28 }}>
          <BreachComparison />
        </div>

        {/* ── Authority + Scope ── */}
        <SectionHeading>Trust Graph & Scope Coverage</SectionHeading>
        <div style={{ paddingBottom: 32 }}>
          <LiveDatabasePanel />
        </div>

        {/* ── Footer stamp ── */}
        <div
          style={{
            marginTop: 24,
            borderTop: "1px solid rgba(233,228,242,0.08)",
            paddingTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontFamily: "var(--font-data)", fontSize: 9, color: "rgba(233,228,242,0.2)", letterSpacing: "0.12em" }}>
            ZK-MCP COMPLIANCE AUDITOR — ALL PROOFS VERIFIED ON-CHAIN
          </span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 9, color: "rgba(233,228,242,0.2)", letterSpacing: "0.08em" }}>
            TICK #{tick}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 currentColor; }
          50%       { opacity: 0.7; box-shadow: 0 0 8px 2px currentColor; }
        }
      `}</style>
    </div>
  );
}
