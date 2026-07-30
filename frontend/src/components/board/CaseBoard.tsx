import { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { Node } from './Node';
import { Thread } from './Thread';
import { Checkpoint } from './Checkpoint';
import { Telegram } from './Telegram';
import { InspectorDrawer } from './InspectorDrawer';
import {
  NODES, EDGES,
  type NodeId, type EdgeId,
  type NodeVisualState, type ThreadState, type CheckpointState,
} from './topology';

/* ── Board state types (all props-driven; Phase 3 swaps data source) ── */
export interface BoardNodeState {
  visual: NodeVisualState;
  stamp?: { state: 'pass' | 'fail'; visible: boolean };
}

export interface BoardEdgeState {
  thread: ThreadState;
  checkpoint?: { state: CheckpointState; reason?: string };
  telegram?: boolean;
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
  onNodeClick?: (id: NodeId) => void;
}

/* ── Layout: node positions in the topology grid ──────────────────── */
// Each entry maps node ID → CSS position within the board container
const NODE_POSITIONS: Record<NodeId, React.CSSProperties> = {
  'gateway':       { top: '3%',  left: '50%', transform: 'translateX(-50%)' },
  'support-agent': { top: '30%', left: '50%', transform: 'translateX(-50%)' },
  'admin-agent':   { top: '30%', left: '7%' },
  'issuer':        { top: '60%', left: '27%' },
  'finance':       { top: '60%', left: '55%' },
  'compliance':    { top: '80%', left: '55%' },
  'admin-mcp':     { top: '60%', left: '7%' },
};

export function CaseBoard({ boardState, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<NodeId, HTMLDivElement | null>>>({});
  const [nodeRects, setNodeRects] = useState<Partial<Record<NodeId, NodeRect>>>({});
  const [inspectorNode, setInspectorNode] = useState<NodeId | null>(null);

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
    setInspectorNode(id);
    onNodeClick?.(id);
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#EDE6D6',
      }}
    >
      {/* ── Paper grain overlay ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Section label ── */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: "'Special Elite', serif",
            fontSize: 10,
            color: 'rgba(31,27,22,0.2)',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
          }}
        >
          CASE BOARD — AGENT TOPOLOGY
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

        {EDGES.map((edge) => {
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
      {NODES.map((nodeDef) => {
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
                    fontFamily: "'Special Elite', serif",
                    fontSize: 13,
                    color: ns.stamp.state === 'pass' ? '#2F4A3B' : '#B23A2F',
                    border: `2.5px solid ${ns.stamp.state === 'pass' ? '#2F4A3B' : '#B23A2F'}`,
                    padding: '2px 8px',
                    borderRadius: 2,
                    letterSpacing: '0.12em',
                    display: 'inline-block',
                    opacity: 0.82,
                    transform: 'rotate(-5deg)',
                    animation: 'stamp-land 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
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

      {/* ── Inspector drawer ── */}
      <InspectorDrawer
        open={inspectorNode !== null}
        onClose={() => setInspectorNode(null)}
        requestId={inspectorNode ? `node:${inspectorNode}` : undefined}
      />
    </div>
  );
}
