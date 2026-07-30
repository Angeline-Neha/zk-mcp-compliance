import { useState, useEffect, useRef, useCallback } from 'react';
import type { CaseBoardState } from '../components/board/CaseBoard';
import type { DocketEntry } from '../components/layout/Docket';
import {
  type RequestUpdateEvent,
  type StatsUpdateEvent,
  rawToCaseBoardState,
  IDLE_BOARD_STATE,
} from './requestStateMachine';

const GATEWAY_URL = 'http://localhost:4006';
const BOARD_TTL_MS = 4000;  // how long to show a resolved board state before fading back to idle
const MAX_DOCKET   = 15;    // docket shows last 15 entries
const MAX_WIRE     = 200;   // wire shows last 200 log lines

export interface WireLine {
  id:        number;
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
  const [boardState, setBoardState]       = useState<CaseBoardState>(IDLE_BOARD_STATE);
  const [docketEntries, setDocketEntries] = useState<DocketEntry[]>([]);
  const [wireLines, setWireLines]         = useState<WireLine[]>([]);
  const [stats, setStats]                 = useState({ requestsPerMin: 0, verifiedPct: 100, agentsOnline: 0 });

  const lastEventId  = useRef<string | undefined>(undefined);
  const boardTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef        = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const url = lastEventId.current
      ? `${GATEWAY_URL}/events`  // browser EventSource handles Last-Event-ID automatically
      : `${GATEWAY_URL}/events`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('open', () => setConnected(true));

    es.addEventListener('error', () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect after 2s — EventSource also reconnects natively, but this
      // ensures we apply the ring-buffer backfill URL correctly
      setTimeout(connect, 2000);
    });

    /* ── request_update ── */
    es.addEventListener('request_update', (e: MessageEvent) => {
      lastEventId.current = e.lastEventId;
      try {
        const ev: RequestUpdateEvent = JSON.parse(e.data);

        // Board: show resolved state, then fade back to idle after TTL
        if (ev.boardState) {
          setBoardState(rawToCaseBoardState(ev.boardState));
          if (boardTimer.current) clearTimeout(boardTimer.current);
          boardTimer.current = setTimeout(() => setBoardState(IDLE_BOARD_STATE), BOARD_TTL_MS);
        }

        // Docket
        const dEntry: DocketEntry = {
          id:       ev.requestId,
          timestamp: ev.docket.ts,
          agent:    ev.docket.agent,
          tool:     ev.docket.tool,
          outcome:  ev.docket.outcome,
        };
        setDocketEntries((prev) => [dEntry, ...prev].slice(0, MAX_DOCKET));

        // Wire
        const wLine: WireLine = {
          id:      ++wireLineId,
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
      } catch (err) {
        console.warn('request_update parse error', err);
      }
    });

    /* ── stats_update ── */
    es.addEventListener('stats_update', (e: MessageEvent) => {
      try {
        const ev: StatsUpdateEvent = JSON.parse(e.data);
        setStats({
          requestsPerMin: ev.requestsPerMin,
          verifiedPct:    ev.verifiedPct,
          agentsOnline:   ev.agentsOnline,
        });
        setConnected(ev.connected);
      } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (boardTimer.current) clearTimeout(boardTimer.current);
    };
  }, [connect]);

  return { connected, boardState, docketEntries, wireLines, stats };
}
