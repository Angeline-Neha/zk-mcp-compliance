import { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { Node } from './Node';
import { Thread } from './Thread';
import { Checkpoint } from './Checkpoint';
import { Telegram } from './Telegram';
import {
  NODES, EDGES,
  type NodeId, type EdgeId,
  type NodeVisualState, type ThreadState, type CheckpointState,
} from './topology';
import type { ThreadPulse } from '../../lib/requestStateMachine';

/* ── Board state types (all props-driven; Phase 3 swaps data source) ── */
export interface BoardNodeState {
  visual: NodeVisualState;
  stamp?: { state: 'pass' | 'fail'; visible: boolean };
}

export interface BoardEdgeState {
  thread: ThreadState;
  checkpoint?: { state: CheckpointState; reason?: string };
  telegram?: boolean;
  /** Concurrent in-flight pulses (Phase 3) */
  pulses?: ThreadPulse[];
}

export interface CaseBoardState {
  nodes: Partial<Record<NodeId, BoardNodeState>>;
  edges: Partial<Record<EdgeId, BoardEdgeState>>;
}



interface NodeRect {
  cx: number;
  top: number;
  bottom: number;
}

interface Props {
  boardState: CaseBoardState;
  agentVitals?: Record<string, number[]>;
  onNodeClick?: (id: NodeId) => void;
  onInspectRequest?: (requestId: string) => void;
}

/* ── Layout: node positions in the topology grid ──────────────────── */
// Each entry maps node ID → CSS position within the board container
const NODE_POSITIONS: Record<NodeId, React.CSSProperties> = {
  'gateway':       { top: '3%',  left: '50%', transform: 'translateX(-50%)' },
  'support-agent': { top: '32%', left: '50%', transform: 'translateX(-50%)' },
  'admin-agent':   { top: '30%', left: '7%' },
  'issuer':        { top: '55%', left: '27%' },
  'finance':       { top: '55%', left: '55%' },
  'compliance':    { top: '81%', left: '55%' },
  'admin-mcp':     { top: '60%', left: '7%' },
};

export function CaseBoard({ boardState, agentVitals, onNodeClick, onInspectRequest }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<NodeId, HTMLDivElement | null>>>({});
  const [nodeRects, setNodeRects] = useState<Partial<Record<NodeId, NodeRect>>>({});

  /* ── Measure node positions after layout ── */
  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const rects: Partial<Record<NodeId, NodeRect>> = {};
    for (const [id, el] of Object.entries(nodeRefs.current) as [NodeId, HTMLDivElement | null][]) {
      if (el) {
        const r = el.getBoundingClientRect();
        rects[id] = {
          cx:     r.left - cr.left + r.width / 2,
          top:    r.top  - cr.top,
          bottom: r.top  - cr.top + r.height,
        };
      }
    }
    setNodeRects(rects);
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  function handleNodeClick(id: NodeId) {
    onNodeClick?.(id);
    onInspectRequest?.(id);
  }

  return (
    <div
      ref={containerRef}
      className="zk-board-grid"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── Section label ── */}
      <div style={{ position: 'absolute', top: 10, left: 14, zIndex: 2, pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, color: 'rgba(10,51,35,0.5)' }}>
          agent topology
        </span>
      </div>

      {/* ── SVG threads layer (behind cards) ── */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'visible',
        }}
      >
        <defs>
          <style>{`
            @keyframes dash-march { to { stroke-dashoffset: -20; } }
          `}</style>
        </defs>

        {EDGES.filter((edge) => edge.from !== 'admin-agent' && edge.to !== 'admin-agent' && edge.from !== 'admin-mcp' && edge.to !== 'admin-mcp').map((edge) => {
          const fromRect = nodeRects[edge.from];
          const toRect   = nodeRects[edge.to];
          const edgeState = boardState.edges[edge.id];
          const threadState: ThreadState = edgeState?.thread ?? 'idle';
          const cpState = edgeState?.checkpoint;
          const showTelegram = edgeState?.telegram ?? false;

          const x1 = fromRect?.cx ?? 0;
          const y1 = fromRect?.bottom ?? 0;
          const x2 = toRect?.cx ?? 0;
          const y2 = toRect?.top ?? 0;
          const hasRects = !!fromRect && !!toRect;

          return (
            <g key={edge.id}>
              <Thread
                id={edge.id}
                fromRect={fromRect}
                toRect={toRect}
                state={threadState}
                pulses={edgeState?.pulses}
              />

              {hasRects && cpState && cpState.state !== 'hidden' && (
                <Checkpoint
                  id={edge.id}
                  state={cpState.state}
                  reason={cpState.reason}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  t={edge.checkpointAt ?? 0.5}
                />
              )}

              {hasRects && showTelegram && edge.callSig && (
                <Telegram
                  callSig={edge.callSig}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  t={0.38}
                  visible
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Node cards (above threads) ── */}
      {NODES.filter((n) => n.id !== 'admin-agent' && n.id !== 'admin-mcp').map((nodeDef) => {
        const ns = boardState.nodes[nodeDef.id] ?? { visual: 'idle' };
        return (
          <div
            key={nodeDef.id}
            style={{
              position: 'absolute',
              zIndex: 10,
              ...NODE_POSITIONS[nodeDef.id],
            }}
          >
            <Node
              ref={(el) => { nodeRefs.current[nodeDef.id] = el; }}
              id={nodeDef.id}
              label={nodeDef.label}
              port={nodeDef.port}
              badge={nodeDef.badge}
              role={nodeDef.role}
              icon={nodeDef.icon}
              visualState={ns.visual}
              vitals={agentVitals?.[nodeDef.id] ? { rollingPassRate: agentVitals[nodeDef.id] } : undefined}
              nestedAnnotation={
                nodeDef.id === 'gateway'
                  ? 'orchestrator-agent  ↳ handleIncomingStructuredTask()'
                  : undefined
              }
              onClick={() => handleNodeClick(nodeDef.id)}
            />

            {/* Stamp overlay */}
            {ns.stamp?.visible && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  pointerEvents: 'none',
                  zIndex: 11,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--zk-sans)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: ns.stamp.state === 'pass' ? '#53662D' : '#A8362C',
                    border: `2px solid ${ns.stamp.state === 'pass' ? '#53662D' : '#A8362C'}`,
                    backgroundColor: '#FCFBEA',
                    padding: '2px 8px',
                    borderRadius: 6,
                    display: 'inline-block',
                    transform: 'rotate(-3deg)',
                    animation: 'stamp-land-overshoot 0.5s cubic-bezier(.2,1.6,.4,1) forwards',
                    textTransform: 'uppercase',
                  }}
                >
                  {ns.stamp.state === 'pass' ? 'APPROVED' : 'BLOCKED'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
