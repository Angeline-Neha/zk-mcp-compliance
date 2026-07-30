import { Express, Response } from "express";

const ISSUER_URL = process.env.ISSUER_URL ?? "http://localhost:4001";
const clients = new Set<Response>();
let lastSeenId: string | null = null;

export function registerSSE(app: Express) {
  app.get("/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    clients.add(res);
    req.on("close", () => clients.delete(res));
  });

  setInterval(async () => {
  try {
    const r = await fetch(`${ISSUER_URL}/audit-log?limit=10`);
    if (!r.ok) throw new Error(`issuer-service returned ${r.status}`);
    const { entries } = await r.json();
    if (entries.length === 0) return;

    let fresh: any[];
    if (lastSeenId === null) {
      fresh = [entries[0]];
    } else {
      const idx = entries.findIndex((e: any) => e.id === lastSeenId);
      fresh = idx === -1 ? entries.slice().reverse() : entries.slice(0, idx).reverse();
    }
    lastSeenId = entries[0].id;

    for (const entry of fresh) {
      for (const client of clients) {
        try {
            client.write(`data: ${JSON.stringify(entry)}\n\n`);
        } catch {
            clients.delete(client);
        }
      }
    }
  } catch (err) {
    console.error("SSE poll failed:", err instanceof Error ? err.message : err);
  }
}, 1500);
}