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
  left: number;
  right: number;
}

interface Props {
  boardState: CaseBoardState;
  agentVitals?: Record<string, number[]>;
  onNodeClick?: (id: NodeId) => void;
  onInspectRequest?: (requestId: string) => void;
}

/* ── Layout ────────────────────────────────────────────────────────
   Nodes sit in normal document flow inside a fixed-width canvas, so they
   can never overlap whatever their height. The canvas is then scaled to
   fit the board (down as far as needed, up to 1.4x), and thread geometry is measured in the
   canvas' own coordinates so it stays correct at any scale.            */
const CANVAS_W = 1010;
const NODE_W = 260;
// finance -> compliance runs sideways so the board needs only three rows
const HORIZONTAL_EDGES = new Set<string>(['finance->compliance']);
const ROW_GAP = 84; // room for the call-signature card between rows
const VISIBLE_NODES = NODES.filter((n) => n.id !== 'admin-agent' && n.id !== 'admin-mcp');

export function CaseBoard({ boardState, agentVitals, onNodeClick, onInspectRequest }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<NodeId, HTMLDivElement | null>>>({});
  const [nodeRects, setNodeRects] = useState<Partial<Record<NodeId, NodeRect>>>({});
  const [view, setView] = useState({ s: 1, ox: 0, oy: 0 });

  /* ── Fit the canvas to the board, then measure nodes in canvas coords ── */
  const measure = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const naturalH = canvas.offsetHeight; // unaffected by the CSS transform
    const s = Math.min(1.4, cw / CANVAS_W, (ch - 36) / naturalH);
    setView({ s, ox: (cw - CANVAS_W * s) / 2, oy: Math.max(30, (ch - naturalH * s) / 2) });

    // Rects are read from the DOM, so divide out whatever scale is applied right now.
    const canvasRect = canvas.getBoundingClientRect();
    const applied = canvasRect.width / canvas.offsetWidth || 1;
    const rects: Partial<Record<NodeId, NodeRect>> = {};
    for (const [id, el] of Object.entries(nodeRefs.current) as [NodeId, HTMLDivElement | null][]) {
      if (el) {
        const r = el.getBoundingClientRect();
        rects[id] = {
          cx:     (r.left - canvasRect.left + r.width / 2) / applied,
          top:    (r.top  - canvasRect.top) / applied,
          bottom: (r.top  - canvasRect.top + r.height) / applied,
          left:   (r.left - canvasRect.left) / applied,
          right:  (r.left - canvasRect.left + r.width) / applied,
        };
      }
    }
    setNodeRects(rects);
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (canvasRef.current) ro.observe(canvasRef.current); // node content can change height
    return () => ro.disconnect();
  }, [measure]);

  function handleNodeClick(id: NodeId) {
    onNodeClick?.(id);
    onInspectRequest?.(id);
  }

  function renderNode(id: NodeId) {
    const nodeDef = VISIBLE_NODES.find((n) => n.id === id)!;
    const ns = boardState.nodes[id] ?? { visual: 'idle' };
    return (
      <div key={id} style={{ position: 'relative', zIndex: 10 }}>
        <Node
          ref={(el) => { nodeRefs.current[id] = el; }}
          id={id}
          label={nodeDef.label}
          port={nodeDef.port}
          badge={nodeDef.badge}
          role={nodeDef.role}
          icon={nodeDef.icon}
          visualState={ns.visual}
          vitals={agentVitals?.[id] ? { rollingPassRate: agentVitals[id] } : undefined}
          nestedAnnotation={
            id === 'gateway' ? 'orchestrator-agent  ↳ handleIncomingStructuredTask()' : undefined
          }
          onClick={() => handleNodeClick(id)}
        />

        {/* Verdict stamp hangs off the bottom edge so it never covers node text */}
        {ns.stamp?.visible && (
          <div style={{ position: 'absolute', bottom: -14, right: 12, pointerEvents: 'none', zIndex: 11 }}>
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
  }

  return (
    <div
      ref={containerRef}
      className="zk-board-grid"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      {/* ── Section label ── */}
      <div style={{ position: 'absolute', top: 10, left: 14, zIndex: 2, pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, color: 'rgba(10,51,35,0.5)' }}>
          agent topology
        </span>
      </div>

      {/* ── Scaled canvas: node flow + thread layer share one coordinate space ── */}
      <div
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CANVAS_W,
          transformOrigin: '0 0',
          transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.s})`,
        }}
      >
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 12,
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

            // Vertical edges run bottom -> top; the horizontal one runs right -> left at the source's mid-height.
            const horizontal = HORIZONTAL_EDGES.has(edge.id);
            const lineY = fromRect ? (fromRect.top + fromRect.bottom) / 2 : 0;
            const from = fromRect && horizontal ? { cx: fromRect.right, top: lineY, bottom: lineY } : fromRect;
            const to   = toRect   && horizontal ? { cx: toRect.left,   top: lineY, bottom: lineY } : toRect;

            const x1 = from?.cx ?? 0;
            const y1 = from?.bottom ?? 0;
            const x2 = to?.cx ?? 0;
            const y2 = to?.top ?? 0;
            const hasRects = !!from && !!to;
            // On a sideways edge, lift the call card above the row so it never covers a node.
            const tgShift = horizontal && fromRect ? (fromRect.bottom - fromRect.top) / 2 + 44 : 0;
            const tgShiftX = horizontal ? 80 : 0; // keep it clear of the support-agent call card

            return (
              <g key={edge.id}>
                <Thread
                  id={edge.id}
                  fromRect={from}
                  toRect={to}
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
                    labelPosition={horizontal ? 'above' : 'beside'}
                  />
                )}

                {hasRects && showTelegram && edge.callSig && (
                  <Telegram
                    callSig={edge.callSig}
                    x1={x1 + tgShiftX} y1={y1 - tgShift} x2={x2 + tgShiftX} y2={y2 - tgShift}
                    t={0.38}
                    visible
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Node cards: gateway and support-agent centred over the finance column ── */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: ROW_GAP, padding: '4px 0 18px' }}>
          <div style={{ marginLeft: NODE_W + 60 }}>{renderNode('gateway')}</div>
          <div style={{ marginLeft: NODE_W + 60 }}>{renderNode('support-agent')}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {renderNode('issuer')}
            <div style={{ marginLeft: 60 }}>{renderNode('finance')}</div>
            <div style={{ marginLeft: 170 }}>{renderNode('compliance')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
