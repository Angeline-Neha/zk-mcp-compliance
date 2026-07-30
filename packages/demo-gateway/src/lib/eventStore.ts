/**
 * In-memory ring buffer of SSE events.
 * Supports Last-Event-ID reconnect backfill — on reconnect, client sends
 * the last event ID it saw; we replay everything since that point.
 *
 * Shared globally: all visitors watch the same live board.
 */

export interface SSEEvent {
  id: number;           // monotonically increasing
  type: string;         // event type name
  data: unknown;        // JSON-serialisable payload
}

const RING_SIZE = 500;  // keep last 500 events in memory
const ring: SSEEvent[] = [];
let nextId = 1;

export function pushEvent(type: string, data: unknown): SSEEvent {
  const ev: SSEEvent = { id: nextId++, type, data };
  ring.push(ev);
  if (ring.length > RING_SIZE) ring.shift();
  return ev;
}

/**
 * Returns all events with id > sinceId, in chronological order.
 * If sinceId is null/undefined, returns the last 30 events (initial load).
 */
export function eventsSince(sinceId: number | null): SSEEvent[] {
  if (sinceId === null || sinceId === undefined) {
    return ring.slice(-30);
  }
  return ring.filter((e) => e.id > sinceId);
}

export function formatSSE(ev: SSEEvent): string {
  return `id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev.data)}\n\n`;
}

/* ── Client registry (shared global stream) ─────────────────────── */
type SSEClient = { write: (chunk: string) => void };

const clients = new Set<SSEClient>();

export function registerSSEClient(client: SSEClient): () => void {
  clients.add(client);
  return () => clients.delete(client);
}

export function broadcast(type: string, data: unknown): SSEEvent {
  const ev = pushEvent(type, data);
  const msg = formatSSE(ev);
  for (const client of clients) {
    try {
      client.write(msg);
    } catch {
      clients.delete(client);
    }
  }
  return ev;
}
