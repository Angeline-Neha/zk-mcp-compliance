import { useState, useEffect, useRef, useCallback } from 'react';
import type { CaseBoardState } from '../components/board/CaseBoard';
import type { DocketEntry } from '../components/layout/Docket';
import { GATEWAY_URL } from './api';
import {
  type RequestUpdateEvent,
  type StatsUpdateEvent,
  type TrackedRequest,
  mergeActiveRequests,
  upsertTrackedRequest,
  isTerminalState,
  IDLE_BOARD_STATE,
  MAX_DOCKET,
  MAX_WIRE,
  RESOLVED_TTL_MS,
} from './requestStateMachine';

export interface WireLine {
  id:        number;
  requestId: string;
  ts:        string;
  agent:     string;
  tool:      string;
  outcome:   'pass' | 'fail' | 'pending';
  state:     string;
  reason:    string | null;
  proof1:    string | null;
  proof2:    string | null;
  policy:    string | null;
}

export interface StreamState {
  connected:      boolean;
  reconnecting:   boolean;
  boardState:     CaseBoardState;
  docketEntries:  DocketEntry[];
  wireLines:      WireLine[];
  stats: {
    requestsPerMin: number;
    verifiedPct:    number;
    agentsOnline:   number;
  };
}

let wireLineId = 0;

export function useRequestStream(): StreamState {
  const [connected, setConnected]         = useState(false);
  const [reconnecting, setReconnecting]   = useState(false);
  const [boardState, setBoardState]       = useState<CaseBoardState>(IDLE_BOARD_STATE);
  const [docketEntries, setDocketEntries] = useState<DocketEntry[]>([]);
  const [wireLines, setWireLines]         = useState<WireLine[]>([]);
  const [stats, setStats]                 = useState({ requestsPerMin: 0, verifiedPct: 100, agentsOnline: 0 });

  const requestsRef    = useRef<Map<string, TrackedRequest>>(new Map());
  const seenEventIds   = useRef<Set<string>>(new Set());
  const esRef          = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer      = useRef<ReturnType<typeof setInterval> | null>(null);

  const recomputeBoard = useCallback(() => {
    setBoardState(mergeActiveRequests([...requestsRef.current.values()]));
  }, []);

  const handleRequestUpdate = useCallback((ev: RequestUpdateEvent, eventId: string) => {
    if (seenEventIds.current.has(eventId)) return;
    seenEventIds.current.add(eventId);
    if (seenEventIds.current.size > 2000) {
      const first = seenEventIds.current.values().next().value;
      if (first) seenEventIds.current.delete(first);
    }

    requestsRef.current = upsertTrackedRequest(requestsRef.current, ev);
    recomputeBoard();

    const dEntry: DocketEntry = {
      id:        ev.requestId,
      timestamp: ev.docket.ts,
      agent:     ev.docket.agent,
      tool:      ev.docket.tool,
      outcome:   ev.docket.outcome,
    };

    setDocketEntries((prev) => {
      const without = prev.filter((e) => e.id !== ev.requestId);
      return [dEntry, ...without].slice(0, MAX_DOCKET);
    });

    const wLine: WireLine = {
      id:      ++wireLineId,
      requestId: ev.requestId,
      ts:      ev.docket.ts,
      agent:   ev.agentId,
      tool:    ev.tool,
      outcome: ev.outcome,
      state:   ev.state,
      reason:  ev.reason,
      proof1:  ev.proof1Hash,
      proof2:  ev.proof2Hash,
      policy:  ev.policyCommitment,
    };
    setWireLines((prev) => [wLine, ...prev].slice(0, MAX_WIRE));
  }, [recomputeBoard]);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setReconnecting(seenEventIds.current.size > 0);

    const es = new EventSource(`${GATEWAY_URL}/task/events`);
    esRef.current = es;

    es.addEventListener('open', () => {
      setConnected(true);
      setReconnecting(false);
    });

    es.addEventListener('error', () => {
      setConnected(false);
      setReconnecting(true);
      es.close();
      esRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, 2000);
    });

    es.addEventListener('request_update', (e: MessageEvent) => {
      try {
        const ev: RequestUpdateEvent = JSON.parse(e.data);
        handleRequestUpdate(ev, e.lastEventId);
      } catch (err) {
        console.warn('request_update parse error', err);
      }
    });

    es.addEventListener('stats_update', (e: MessageEvent) => {
      try {
        const ev: StatsUpdateEvent = JSON.parse(e.data);
        setStats({
          requestsPerMin: ev.requestsPerMin,
          verifiedPct:    ev.verifiedPct,
          agentsOnline:   ev.agentsOnline,
        });
      } catch { /* ignore */ }
    });
  }, [handleRequestUpdate]);

  useEffect(() => {
    connect();

    // Recompute board periodically to expire resolved requests + pulse fade
    tickTimer.current = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, req] of requestsRef.current) {
        if (isTerminalState(req.state) && now - req.updatedAt > RESOLVED_TTL_MS) {
          requestsRef.current.delete(id);
          changed = true;
        }
      }
      if (changed || requestsRef.current.size > 0) {
        recomputeBoard();
      }
    }, 500);

    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
  }, [connect, recomputeBoard]);

  return { connected, reconnecting, boardState, docketEntries, wireLines, stats };
}
