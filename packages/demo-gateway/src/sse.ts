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
      const { entries } = await r.json();
      if (entries.length === 0) return;

      const fresh = lastSeenId
        ? entries.filter((e: any) => e.id !== lastSeenId).reverse()
        : [entries[0]];
      lastSeenId = entries[0].id;

      for (const entry of fresh) {
        for (const client of clients) {
          client.write(`data: ${JSON.stringify(entry)}\n\n`);
        }
      }
    } catch {
      // issuer-service not reachable yet — skip this tick silently
    }
  }, 1500);
}