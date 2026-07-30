import { Express, Request, Response } from "express";
import { eventsSince, formatSSE, registerSSEClient, broadcast } from "../lib/eventStore";
import { emitFromAuditEntry, shouldSkipAuditEntry } from "../lib/requestEvents";

const ISSUER_URL = process.env.ISSUER_URL ?? "http://localhost:4001";

const HEALTH_TARGETS = [
  { url: process.env.GATEWAY_HEALTH_URL ?? "http://localhost:4006/health" },
  { url: `${ISSUER_URL}/health` },
  { url: process.env.PROVING_URL ? `${process.env.PROVING_URL}/health` : "http://localhost:4002/health" },
  { url: process.env.FINANCE_URL ? `${process.env.FINANCE_URL}/health` : "http://localhost:4003/health" },
  { url: process.env.SUPPORT_URL ? `${process.env.SUPPORT_URL}/health` : "http://localhost:4004/health" },
  { url: process.env.ADMIN_MCP_URL ? `${process.env.ADMIN_MCP_URL}/health` : "http://localhost:4005/health" },
];

export { broadcast };

/**
 * SSE endpoint — single shared global stream with Last-Event-ID backfill.
 * Mounted at GET /task/events per Phase 3 spec.
 */
export function registerEventsRoutes(app: Express): void {
  app.get("/task/events", handleSSE);
  // Legacy alias during transition
  app.get("/events", handleSSE);

  startAuditPoll();
  startStatsPoll();
}

function handleSSE(req: Request, res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const lastId = req.headers["last-event-id"];
  const sinceId = lastId ? parseInt(lastId as string, 10) : null;
  const missed = eventsSince(sinceId);
  for (const ev of missed) {
    res.write(formatSSE(ev));
  }

  const keepAlive = setInterval(() => {
    try {
      res.write(": keep-alive\n\n");
    } catch {
      /* ignore */
    }
  }, 15_000);

  const unregister = registerSSEClient(res);
  req.on("close", () => {
    unregister();
    clearInterval(keepAlive);
  });
}

/* ── Audit-log poll — catches attack-script traffic not via task routes ── */
const emittedAuditIds = new Set<string>();
let lastAuditId: string | null = null;

function startAuditPoll(): void {
  setInterval(async () => {
    try {
      const r = await fetch(`${ISSUER_URL}/audit-log?limit=20`);
      if (!r.ok) throw new Error(`issuer returned ${r.status}`);
      const { entries } = await r.json();
      if (!entries || entries.length === 0) return;

      let fresh: typeof entries;
      if (lastAuditId === null) {
        lastAuditId = entries[0].id;
        return;
      } else {
        const idx = entries.findIndex((e: { id: string }) => e.id === lastAuditId);
        fresh =
          idx === -1
            ? entries.slice().reverse()
            : entries.slice(0, idx).reverse();
      }
      lastAuditId = entries[0].id;

      for (const entry of fresh) {
        if (emittedAuditIds.has(entry.id)) continue;
        if (shouldSkipAuditEntry(entry)) continue;
        emittedAuditIds.add(entry.id);
        if (emittedAuditIds.size > 2000) {
          const first = emittedAuditIds.values().next().value;
          if (first) emittedAuditIds.delete(first);
        }
        emitFromAuditEntry(entry);
      }
    } catch (err) {
      console.error("SSE audit poll failed:", err instanceof Error ? err.message : err);
    }
  }, 1500);
}

/* ── Stats + health — rolling 60s from audit log ─────────────────── */
function startStatsPoll(): void {
  setInterval(async () => {
    try {
      const [auditRes, agentsOnline] = await Promise.all([
        fetch(`${ISSUER_URL}/audit-log?limit=200`),
        pollAgentsOnline(),
      ]);

      if (!auditRes.ok) return;
      const { entries } = await auditRes.json();
      if (!entries) return;

      const now = Date.now();
      const lastMin = entries.filter(
        (e: { createdAt: string }) => now - new Date(e.createdAt).getTime() < 60_000
      );
      const passed = lastMin.filter((e: { pass: boolean }) => e.pass).length;
      const total = lastMin.length;

      broadcast("stats_update", {
        requestsPerMin: total,
        verifiedPct: total > 0 ? Math.round((passed / total) * 100) : 100,
        agentsOnline,
        connected: true,
      });
    } catch {
      broadcast("stats_update", {
        requestsPerMin: 0,
        verifiedPct: 100,
        agentsOnline: 0,
        connected: false,
      });
    }
  }, 5_000);
}

async function pollAgentsOnline(): Promise<number> {
  const results = await Promise.all(
    HEALTH_TARGETS.map(async (t) => {
      try {
        const r = await fetch(t.url, { signal: AbortSignal.timeout(2000) });
        return r.ok;
      } catch {
        return false;
      }
    })
  );
  return results.filter(Boolean).length;
}
