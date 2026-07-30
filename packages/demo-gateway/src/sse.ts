import { Express, Request, Response } from "express";
import { pushEvent, eventsSince, formatSSE } from "./lib/eventStore";

const ISSUER_URL = process.env.ISSUER_URL ?? "http://localhost:4001";

/* ── Client registry ───────────────────────────────────────────── */
const clients = new Set<Response>();

export function broadcast(type: string, data: unknown) {
  const ev = pushEvent(type, data);
  const msg = formatSSE(ev);
  for (const client of clients) {
    try {
      client.write(msg);
    } catch {
      clients.delete(client);
    }
  }
}

/* ── SSE endpoint with Last-Event-ID backfill ───────────────────── */
export function registerSSE(app: Express) {
  app.get("/events", (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Backfill missed events since Last-Event-ID
    const lastId = req.headers["last-event-id"];
    const sinceId = lastId ? parseInt(lastId as string, 10) : null;
    const missed = eventsSince(sinceId);
    for (const ev of missed) {
      res.write(formatSSE(ev));
    }

    // Keep-alive comment every 15s to prevent proxy timeouts
    const keepAlive = setInterval(() => {
      try { res.write(": keep-alive\n\n"); } catch { /* ignore */ }
    }, 15_000);

    clients.add(res);
    req.on("close", () => {
      clients.delete(res);
      clearInterval(keepAlive);
    });
  });

  /* ── Poll issuer audit-log and emit state-machine events ─────── */
  let lastAuditId: string | null = null;

  setInterval(async () => {
    try {
      const r = await fetch(`${ISSUER_URL}/audit-log?limit=20`);
      if (!r.ok) throw new Error(`issuer returned ${r.status}`);
      const { entries } = await r.json();
      if (!entries || entries.length === 0) return;

      // Find new entries since we last processed
      let fresh: any[];
      if (lastAuditId === null) {
        fresh = [entries[0]]; // just the latest on first poll
      } else {
        const idx = entries.findIndex((e: any) => e.id === lastAuditId);
        fresh = idx === -1
          ? entries.slice().reverse()
          : entries.slice(0, idx).reverse();
      }
      lastAuditId = entries[0].id;

      for (const entry of fresh) {
        // Derive state-machine state from audit log entry
        const state = deriveState(entry);
        const agentLabel = entry.agentId?.split("-").slice(0, 2).join("-") ?? "agent";
        const tool = entry.toolName ?? "unknown";
        const outcome = entry.pass ? "pass" : "fail";

        // Emit structured request_update event
        broadcast("request_update", {
          requestId:  entry.id,
          timestamp:  entry.createdAt,
          agentId:    entry.agentId,
          tool:       entry.toolName,
          scopeAction:entry.scopeAction,
          state,
          outcome,
          reason:     entry.reason ?? null,
          proof1Hash: entry.proof1Hash ?? null,
          proof2Hash: entry.proof2Hash ?? null,
          policyCommitment: entry.policyCommitment ?? null,
          // Derived node/edge states for the board
          boardState: deriveBoardState(entry, state),
          // Docket display fields
          docket: {
            agent:   agentLabel,
            tool,
            outcome,
            ts:      formatTime(entry.createdAt),
          },
        });
      }
    } catch (err) {
      console.error("SSE poll failed:", err instanceof Error ? err.message : err);
    }
  }, 1500);

  /* ── Stats broadcast every 5s ────────────────────────────────── */
  setInterval(async () => {
    try {
      const r = await fetch(`${ISSUER_URL}/audit-log?limit=200`);
      if (!r.ok) return;
      const { entries } = await r.json();
      if (!entries) return;

      const now = Date.now();
      const lastMin = entries.filter(
        (e: any) => now - new Date(e.createdAt).getTime() < 60_000
      );
      const passed = lastMin.filter((e: any) => e.pass).length;
      const total  = lastMin.length;

      broadcast("stats_update", {
        requestsPerMin: total,
        verifiedPct:    total > 0 ? Math.round((passed / total) * 100) : 100,
        agentsOnline:   6,
        connected:      true,
      });
    } catch { /* ignore */ }
  }, 5_000);
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function deriveState(entry: any): string {
  if (!entry.pass) {
    if (entry.reason?.includes("Proof 1") || entry.reason?.includes("sigma")) return "proof1_fail";
    if (entry.reason?.includes("INTENT_BINDING") || entry.reason?.includes("intent")) return "intent_fail";
    return "proof2_fail";
  }
  return "approved";
}

function deriveBoardState(entry: any, state: string) {
  const tool = entry.toolName ?? "";
  const isRefund  = tool.includes("refund");
  const isDeletion = tool.includes("delet");

  const nodeStates: Record<string, string> = {
    gateway: "active",
    "support-agent": isRefund ? "active" : "idle",
    "admin-agent":   isDeletion ? "active" : "idle",
    issuer:          state === "proof1_fail" ? "idle" : "active",
    finance:         state === "approved" ? "active" : "idle",
    compliance:      state === "approved" ? "active" : "idle",
    "admin-mcp":     isDeletion && state === "approved" ? "active" : "idle",
  };

  const edgeStates: Record<string, { thread: string; checkpoint?: { state: string; reason?: string } }> = {
    "gateway->support-agent": isRefund
      ? { thread: "pass", checkpoint: { state: "pass" } }
      : { thread: "idle" },
    "gateway->admin-agent": isDeletion
      ? { thread: "pass" }
      : { thread: "idle" },
    "support-agent->issuer": isRefund ? {
      thread: state === "proof1_fail" ? "fail" : "pass",
      checkpoint: state === "proof1_fail"
        ? { state: "fail", reason: entry.reason ?? "Proof 1 failed" }
        : { state: "pass" },
    } : { thread: "idle" },
    "support-agent->finance": isRefund && state !== "proof1_fail" && state !== "intent_fail" ? {
      thread: state === "proof2_fail" ? "fail" : "pass",
      checkpoint: state === "proof2_fail"
        ? { state: "fail", reason: entry.reason ?? "Proof 2 failed" }
        : { state: "pass" },
    } : { thread: "idle" },
    "finance->compliance": state === "approved" && isRefund
      ? { thread: "pass" }
      : { thread: "idle" },
    "admin-agent->admin-mcp": isDeletion
      ? { thread: state === "approved" ? "pass" : "fail" }
      : { thread: "idle" },
  };

  const stamps: Record<string, { state: string; visible: boolean }> = {};
  if (state === "approved") {
    stamps[isRefund ? "finance" : "admin-mcp"] = { state: "pass", visible: true };
  } else if (state === "proof1_fail") {
    stamps["issuer"] = { state: "fail", visible: true };
  } else if (state === "proof2_fail" || state === "intent_fail") {
    stamps["finance"] = { state: "fail", visible: true };
  }

  return { nodes: nodeStates, edges: edgeStates, stamps };
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
  } catch { return "--:--:--"; }
}