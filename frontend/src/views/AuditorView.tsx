import { useEffect, useState } from "react";
import { Scoreboard } from "../components/auditor/Scoreboard";
import { ProofLatencyStrip } from "../components/auditor/ProofLatencyStrip";
import { LiveDatabasePanel } from "../components/auditor/LiveDatabasePanel";
import { ServiceHealthStrip, useServiceHealth } from "../components/auditor/ServiceHealth";
import { AgentPassRates, BlockedReasons, LatestDecisions, useAuditEntries } from "../components/auditor/AuditInsights";
import { fetchAttackResults } from "../lib/api";

const INK = "#0A3323";
const MOSS = "#53662D";
const RED = "#A8362C";
const PURPLE = "#5E2750";

/* ── Stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent, delay = 0 }: { label: string; value: string | number; sub?: string; accent: string; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="zk-card"
      style={{
        borderLeft: `4px solid ${accent}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(8px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.65 }}>{label}</div>
      <div style={{ font: "500 28px var(--zk-mono)", color: accent, lineHeight: 1.2, margin: "4px 0 0" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ── Threat level ───────────────────────────────────────────────── */
function ThreatLevel({ blockedCount, totalRun }: { blockedCount: number; totalRun: number }) {
  const pct = totalRun === 0 ? 100 : Math.round((blockedCount / totalRun) * 100);
  const level = pct >= 80 ? "Low" : pct >= 50 ? "Medium" : "High";
  const color = pct >= 80 ? MOSS : pct >= 50 ? PURPLE : RED;

  return (
    <div className="zk-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px" }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          font: "600 12px var(--zk-sans)",
          color,
        }}
      >
        {level}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Threat level</div>
        <div style={{ font: "400 12px var(--zk-mono)", opacity: 0.7 }}>
          {blockedCount}/{totalRun} attacks blocked
        </div>
        <div className="zk-bar" style={{ width: 140, marginTop: 6 }}>
          <span style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

/* ── Main view ──────────────────────────────────────────────────── */
export function AuditorView() {
  const [outcomes, setOutcomes] = useState<Record<string, { status: "not_run" | "blocked" | "passed" }>>({});
  const health = useServiceHealth();
  const { entries, error } = useAuditEntries();

  useEffect(() => {
    fetchAttackResults().then(setOutcomes).catch(() => {});
    const iv = setInterval(() => {
      fetchAttackResults().then(setOutcomes).catch(() => {});
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  const allRun = Object.values(outcomes).filter((o) => o.status !== "not_run");
  const blocked = allRun.filter((o) => o.status === "blocked").length;
  const passed = allRun.filter((o) => o.status === "passed").length;
  const notRun = 9 - allRun.length;
  const upCount = health?.filter((s) => s.up).length ?? 0;

  return (
    <div className="zk-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        <div>
          <h1 style={{ font: "700 20px var(--zk-sans)", margin: 0, letterSpacing: "-0.01em" }}>Auditor</h1>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.65 }}>Cryptographic integrity and attack outcomes, live.</p>
        </div>
        <ThreatLevel blockedCount={blocked} totalRun={allRun.length} />
      </div>

      <div className="zk-stats zk-section">
        <StatCard label="Attacks blocked" value={blocked} accent={MOSS} delay={0} />
        <StatCard label="Attacks passed" value={passed} accent={RED} delay={80} />
        <StatCard label="Not yet run" value={notRun} accent="rgba(10,51,35,0.4)" delay={160} />
        <StatCard label="Block rate" value={allRun.length ? `${Math.round((blocked / allRun.length) * 100)}%` : "—"} accent={PURPLE} delay={240} />
        <StatCard
          label="Services up"
          value={health ? `${upCount}/${health.length}` : "—"}
          sub={health ? (upCount === health.length ? "All healthy" : "Some services are down") : "Checking…"}
          accent={health && upCount < health.length ? RED : INK}
          delay={320}
        />
      </div>

      <div className="zk-section">
        <ServiceHealthStrip health={health} />
      </div>

      <div className="zk-grid-8-4 zk-section">
        <Scoreboard />
        <LatestDecisions entries={entries} error={error} />
      </div>

      <div className="zk-grid-2 zk-section">
        <AgentPassRates entries={entries} error={error} />
        <BlockedReasons entries={entries} error={error} />
      </div>

      <div className="zk-section">
        <ProofLatencyStrip />
      </div>

      <LiveDatabasePanel />
    </div>
  );
}
