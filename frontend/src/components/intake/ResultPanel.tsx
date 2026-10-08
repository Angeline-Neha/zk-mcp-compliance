import { useEffect, useRef, useState } from "react";
import type { TaskResult, RedTeamToolCall } from "../../lib/api";

/* ── Per-attack live workflow steps shown while LLM is running ── */
const ATTACK_STEPS: Record<string, string[]> = {
  "1": [
    "Requesting attestation from Issuer MCP…",
    "Fetching nonce from finance-mcp-server…",
    "Generating Sigma proof (Proof 1)…",
    "Replaying captured proof to gate…",
    "Gate checking nonce burn status…",
    "Evaluating gate response…",
  ],
  "2": [
    "Registering attacker with refund scope…",
    "Requesting nonce for admin-mcp-server…",
    "Generating proof with refund credentials…",
    "Calling delete_account with refund proof…",
    "Gate checking scope match…",
    "Evaluating gate response…",
  ],
  "3": [
    "Requesting base attestation (limit: $50)…",
    "Constructing delegation with $999,999 limit…",
    "Submitting over-scoped delegation to gate…",
    "Gate validating delegation chain…",
    "Checking granted vs requested limits…",
    "Evaluating gate response…",
  ],
  "4": [
    "Attempting to reach un-attested tool…",
    "Forging attestation for delete_account…",
    "Generating proof for non-existent attestation…",
    "Submitting to admin gate…",
    "Gate verifying attestation chain…",
    "Evaluating gate response…",
  ],
  "5": [
    "Requesting attestation on finance-mcp-server…",
    "Fetching nonce for finance-mcp-server…",
    "Generating Proof 1 for finance server…",
    "Submitting finance proof to admin-mcp-server…",
    "Gate checking server binding in proof…",
    "Evaluating gate response…",
  ],
  "6": [
    "Registering attacker identity…",
    "Generating valid proof before revocation…",
    "Revoking agent mid-flight…",
    "Submitting proof after revocation…",
    "Gate checking revocation status…",
    "Evaluating gate response…",
  ],
  "7": [
    "Registering attacker identity…",
    "Fetching nonce from gate…",
    "Forging policy commitment with $999,999 limit…",
    "Generating fake Groth16 compliance proof…",
    "Submitting forged proof to finance gate…",
    "Gate verifying commitment against registry…",
    "Evaluating gate response…",
  ],
};

const DEFAULT_STEPS = [
  "Initialising red team agent…",
  "Calling Issuer MCP to register…",
  "Fetching cryptographic nonce…",
  "Generating proof materials…",
  "Submitting to live gate…",
  "Awaiting gate verdict…",
];


/* ── Live workflow shown while the red team agent runs ── */
function LiveWorkflow({ attackId }: { attackId: string }) {
  const steps = ATTACK_STEPS[attackId] ?? DEFAULT_STEPS;
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setActive(0);
    let current = 0;
    timerRef.current = setInterval(() => {
      current += 1;
      if (current < steps.length) setActive(current);
      else clearInterval(timerRef.current!);
    }, 2200);
    return () => clearInterval(timerRef.current!);
  }, [attackId, steps.length]);

  return (
    <div style={{ padding: "4px 2px" }}>
      <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 13 }}>Attack {attackId} in progress</p>
      {steps.map((s, i) => {
        const done = i < active;
        const now = i === active;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", opacity: done || now ? 1 : 0.35, transition: "opacity 0.3s" }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
                color: done ? "#fff" : "#5E2750",
                background: done ? "#839958" : "transparent",
                border: `1.5px solid ${done ? "#839958" : now ? "#5E2750" : "rgba(10,51,35,0.25)"}`,
                animation: now ? "zk-blink 1s ease-in-out infinite" : "none",
                flexShrink: 0,
              }}
            >
              {done ? "✓" : ""}
            </span>
            <span style={{ font: "400 12.5px var(--zk-mono)" }}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Proof result parser (unchanged logic) ── */
function toolCallToProofPanels(call: { tool: string; result: unknown }) {
  if (call.tool !== "request_refund" && call.tool !== "request_deletion") return null;
  const result = call.result as { allowed?: boolean; reason?: string; intentBindingFail?: boolean } | undefined;
  if (!result || typeof result.allowed !== "boolean") return null;
  const proof1Failed = result.reason?.startsWith("Proof 1") ?? false;
  const intentFailed = result.intentBindingFail === true || (result.reason?.includes("INTENT_BINDING_FAIL") ?? false);
  const proof2Failed = !result.allowed && !proof1Failed && !intentFailed;
  return { result, proof1Failed, intentFailed, proof2Failed };
}

type Step = "pass" | "fail" | "skipped";
const STEP_COLOR: Record<Step, string> = { pass: "#53662D", fail: "#A8362C", skipped: "rgba(10,51,35,0.45)" };
const STEP_LABEL: Record<Step, string> = { pass: "Passed", fail: "Rejected", skipped: "Not reached" };

function ProofChain({ parsed }: { parsed: NonNullable<ReturnType<typeof toolCallToProofPanels>> }) {
  const { result, proof1Failed, intentFailed, proof2Failed } = parsed;
  const p1: Step = proof1Failed ? "fail" : "pass";
  const intent: Step = proof1Failed ? "skipped" : intentFailed ? "fail" : "pass";
  const p2: Step = proof1Failed || intentFailed ? "skipped" : proof2Failed ? "fail" : "pass";
  const chain: { label: string; state: Step }[] = [
    { label: "Proof 1: authorization", state: p1 },
    { label: "Intent binding", state: intent },
    { label: "Proof 2: compliance", state: p2 },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: 10 }}>
      {chain.map((c) => (
        <div key={c.label} style={{ border: "1px solid var(--zk-rule)", borderLeft: `4px solid ${STEP_COLOR[c.state]}`, borderRadius: 8, padding: "8px 12px", background: "var(--zk-paper)" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{c.label}</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: STEP_COLOR[c.state] }}>{STEP_LABEL[c.state]}</div>
        </div>
      ))}
      {result?.reason && !result.allowed && (
        <div style={{ gridColumn: "1 / -1", font: "400 12px var(--zk-mono)", color: "#A8362C", background: "#F8E6E2", borderRadius: 6, padding: "6px 10px" }}>
          {result.reason}
        </div>
      )}
    </div>
  );
}

/* ── One-line summary of a tool result for the timeline ── */
function summarize(call: { tool: string; input: unknown; result: unknown }, parsed: ReturnType<typeof toolCallToProofPanels>, attack: boolean) {
  if (parsed) {
    const ok = parsed.result.allowed;
    const good = attack ? !ok : ok;
    return (
      <>
        <span style={{ font: "600 11.5px var(--zk-sans)", padding: "2px 9px", borderRadius: 99, marginRight: 8, background: good ? "rgba(131,153,88,0.22)" : "rgba(168,54,44,0.12)", color: good ? "#53662D" : "#A8362C" }}>
          {ok ? (attack ? "Exploited" : "Allowed") : "Blocked"}
        </span>
        <span style={{ opacity: 0.75 }}>{parsed.result.reason ?? ""}</span>
      </>
    );
  }
  if (call.tool === "lookup_order") {
    const r = call.result as Record<string, unknown> | undefined;
    const parts: [string, unknown, ((v: number) => boolean)?][] = [
      ["amount $", r?.amount],
      ["acct age ", r?.accountAgeDays, (v) => v >= 30],
      ["past refunds ", r?.pastRefundCount, (v) => v < 2],
      ["txn age ", r?.transactionAgeDays, (v) => v <= 90],
    ];
    return (
      <span>
        {parts.map(([label, val, good], i) => (
          <span key={i} style={{ marginRight: 12, color: good && typeof val === "number" ? (good(val) ? "#53662D" : "#A8362C") : undefined }}>
            {label}{String(val ?? "—")}
          </span>
        ))}
      </span>
    );
  }
  return <span style={{ opacity: 0.75 }}>{JSON.stringify(call.result)}</span>;
}

function CallTimeline({ calls, attack }: { calls: { tool: string; input: unknown; result: unknown }[]; attack: boolean }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  const allOpen = open.size === calls.length;

  return (
    <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>Tool calls ({calls.length})</b>
        <button className="zk-btn-ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(calls.map((_, i) => i)))}>
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div style={{ border: "1px solid var(--zk-rule)", borderRadius: 8, overflow: "auto", background: "#fff" }}>
        {calls.map((c, i) => {
          const parsed = toolCallToProofPanels(c);
          const isOpen = open.has(i);
          return (
            <div key={i} style={{ borderBottom: i < calls.length - 1 ? "1px solid var(--zk-rule)" : 0 }}>
              <button
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                style={{ display: "grid", gridTemplateColumns: "28px 150px minmax(0,1fr)", gap: 10, alignItems: "baseline", width: "100%", textAlign: "left", padding: "9px 12px", border: 0, background: isOpen ? "rgba(94,39,80,0.06)" : "transparent", color: "inherit", cursor: "pointer", font: "400 12px var(--zk-mono)" }}
              >
                <span style={{ opacity: 0.5 }}>{String(i + 1).padStart(2, "0")}</span>
                <b style={{ font: "600 12.5px var(--zk-mono)", color: "#5E2750", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.tool}</b>
                <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{summarize(c, parsed, attack)}</span>
              </button>
              {isOpen && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, padding: "4px 12px 12px 50px" }}>
                  {([["Input", c.input], ["Response", c.result]] as const).map(([label, v]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 3 }}>{label}</div>
                      <pre style={{ margin: 0, font: "400 11.5px/1.5 var(--zk-mono)", background: "#0A3323", color: "#F7F4D5", borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 200, overflow: "auto" }}>
                        {JSON.stringify(v, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface RedTeamOutcome {
  title: string;
  blocked: boolean;
  finalResponse: string;
  toolCalls: RedTeamToolCall[];
}

interface Props {
  redTeamRunning: boolean;
  redTeamAttackId: string;
  loading: boolean;
  salamiProgress: { slice: number; total: number } | null;
  error: string | null;
  redTeam: RedTeamOutcome | null;
  result: TaskResult | null;
  revealedCount: number;
  /** Baseline page: no proofs exist, and an allowed attack means the baseline was exploited. */
  baseline?: boolean;
  /** The filed ticket was an attack attempt. */
  attackTicket?: boolean;
  /** Token replay runs: one entry per identical ticket. */
  replayLog?: { slice: number; result: TaskResult }[];
}

/** Everything a report screenshot needs, on one screen: verdict, proof chain and a compact call timeline. */
export function ResultPanel({ redTeamRunning, redTeamAttackId, loading, salamiProgress, error, redTeam, result, revealedCount, baseline = false, attackTicket = false, replayLog = [] }: Props) {
  const calls: { tool: string; input: unknown; result: unknown }[] = redTeam
    ? redTeam.toolCalls
    : (result?.toolCalls ?? []).slice(0, revealedCount);

  const lastParsed = [...calls].reverse().map(toolCallToProofPanels).find(Boolean) ?? null;
  const done = !!result && revealedCount >= result.toolCalls.length;

  const attack = baseline && (!!redTeam || attackTicket);
  const replays = replayLog.map((r) => {
    const o = r.result.toolCalls.find((c) => c.tool === "request_refund")?.result as { allowed?: boolean; reason?: string; refundId?: string } | undefined;
    return { slice: r.slice, ok: o?.allowed === true, text: o?.allowed ? (o.refundId ?? "refund issued") : (o?.reason ?? "no request_refund call") };
  });
  const exploited = replays.filter((r) => r.ok).length;

  let verdict: { label: string; good: boolean; heading: string; text: string } | null = null;
  if (redTeam) {
    verdict = {
      label: redTeam.blocked ? "Blocked" : baseline ? "Exploited" : "Vulnerable",
      good: redTeam.blocked,
      heading: `${baseline ? "LLM attack" : "Red team"}: ${redTeam.title}`,
      text: redTeam.finalResponse,
    };
  } else if (replays.length > 0) {
    verdict = {
      label: exploited > 0 ? "Exploited" : "Blocked",
      good: exploited === 0,
      heading: `Token replay: ${replays.length} identical ticket${replays.length !== 1 ? "s" : ""}`,
      text: `${exploited} of ${replays.length} replays succeeded.`,
    };
  } else if (result && done) {
    const ok = lastParsed ? lastParsed.result.allowed === true : null;
    verdict = {
      label: ok === null ? "Done" : ok ? (attack ? "Exploited" : "Approved") : baseline && !attack ? "Denied" : "Blocked",
      good: ok === null ? true : attack ? !ok : ok,
      heading: "Ticket result",
      text: result.finalResponse,
    };
  }

  return (
    <section className="zk-card" style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0, height: "100%", overflow: "auto" }} aria-live="polite">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 className="zk-card-title" style={{ margin: 0 }}>Result</h3>
        {salamiProgress && <span style={{ font: "400 12px var(--zk-mono)", color: "#A8362C" }}>slice {salamiProgress.slice}/{salamiProgress.total}</span>}
      </div>

      {error && (
        <div style={{ font: "400 12.5px var(--zk-mono)", color: "#A8362C", background: "#F8E6E2", borderLeft: "3px solid #A8362C", padding: "10px 14px", borderRadius: "0 6px 6px 0" }}>{error}</div>
      )}

      {redTeamRunning && <LiveWorkflow attackId={redTeamAttackId} />}
      {loading && !redTeamRunning && calls.length === 0 && <p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>Running<span className="cursor-blink" /></p>}

      {!redTeamRunning && !error && !redTeam && !result && !loading && replays.length === 0 && (
        <div style={{ margin: "auto", textAlign: "center", maxWidth: 360, opacity: 0.65 }}>
          <p style={{ fontWeight: 600, margin: "0 0 4px" }}>No run yet</p>
          <p style={{ fontSize: 13, margin: 0 }}>Fire a red team attack or file a ticket. The verdict, proof chain and tool calls appear here.</p>
        </div>
      )}

      {verdict && !redTeamRunning && (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "12px 14px", border: "1px solid var(--zk-rule)", borderLeft: `4px solid ${verdict.good ? "#839958" : "#A8362C"}`, borderRadius: 8, background: "var(--zk-paper)" }}>
          <span
            className="verdict-stamp"
            style={{ color: verdict.good ? "#53662D" : "#A8362C", flexShrink: 0 }}
          >
            {verdict.label}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{verdict.heading}</div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{verdict.text}</p>
          </div>
        </div>
      )}

      {replays.length > 0 && !redTeamRunning && (
        <div style={{ border: "1px solid var(--zk-rule)", borderRadius: 8, background: "#fff" }}>
          {replays.map((r, i) => (
            <div key={r.slice} style={{ display: "grid", gridTemplateColumns: "70px 96px minmax(0,1fr)", gap: 10, alignItems: "center", padding: "9px 12px", borderBottom: i < replays.length - 1 ? "1px solid var(--zk-rule)" : 0, font: "400 12px var(--zk-mono)" }}>
              <span style={{ opacity: 0.6 }}>replay {r.slice}</span>
              <span style={{ font: "600 11.5px var(--zk-sans)", padding: "2px 9px", borderRadius: 99, textAlign: "center", background: r.ok ? "rgba(168,54,44,0.12)" : "rgba(131,153,88,0.22)", color: r.ok ? "#A8362C" : "#53662D" }}>{r.ok ? "Exploited" : "Blocked"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.text}>{r.text}</span>
            </div>
          ))}
        </div>
      )}
      {lastParsed && !baseline && !redTeamRunning && <ProofChain parsed={lastParsed} />}
      {calls.length > 0 && !redTeamRunning && <CallTimeline key={redTeam ? "rt" : "tk"} calls={calls} attack={attack} />}
    </section>
  );
}
