import { forwardRef } from 'react';
import type { NodeVisualState } from './topology';
import type { IconType } from './icons';
import { AgentIcon } from './icons';

export interface NodeProps {
  id: string;
  label: string;
  port?: string;
  badge: string;
  role: string;
  icon: IconType;
  visualState: NodeVisualState;
  /** In-process annotation rendered inside this card */
  nestedAnnotation?: string;
  vitals?: { rollingPassRate: number[] };
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const STATE_STYLES: Record<NodeVisualState, React.CSSProperties> = {
  idle: {
    borderColor: 'rgba(31,27,22,0.18)',
    boxShadow: '2px 2px 6px rgba(31,27,22,0.10), 0 0 0 0.5px rgba(31,27,22,0.05)',
  },
  active: {
    borderColor: 'rgba(176,141,87,0.5)',
    boxShadow: '2px 2px 10px rgba(31,27,22,0.14), 0 0 18px rgba(176,141,87,0.18)',
  },
  targeted: {
    borderColor: '#B08D57',
    boxShadow: '2px 2px 10px rgba(31,27,22,0.14), 0 0 0 2px rgba(176,141,87,0.2)',
  },
  unauthorized: {
    borderColor: 'rgba(178,58,47,0.3)',
    borderStyle: 'dashed',
    boxShadow: 'none',
  },
};

export const Node = forwardRef<HTMLDivElement, NodeProps>(function Node(
  { id, label, port, badge, role, icon, visualState, nestedAnnotation, vitals, onClick, style, className },
  ref
) {
  const stateStyle = STATE_STYLES[visualState];
  const isActive = visualState === 'active' || visualState === 'targeted';

  return (
    <div
      ref={ref}
      id={`node-${id}`}
      onClick={onClick}
      className={className}
      style={{
        width: 200,
        backgroundColor: '#EDE6D6',
        border: '1.5px solid',
        borderRadius: 3,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        userSelect: 'none',
        ...stateStyle,
        ...style,
      }}
    >
      {/* Port tab — top-right corner */}
      {port && (
        <div
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            backgroundColor: '#1F1B16',
            borderRadius: '0 3px 0 3px',
            padding: '2px 6px',
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: '#B08D57',
              letterSpacing: '0.05em',
            }}
          >
            {port}
          </span>
        </div>
      )}

      {/* Active pulse ring */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 5,
            border: '1px solid rgba(176,141,87,0.2)',
            pointerEvents: 'none',
            animation: 'pulse-seal 2.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Card body */}
      <div style={{ padding: '10px 12px 10px' }}>
        {/* Role header */}
        <p
          style={{
            fontFamily: "'Archivo', sans-serif",
            fontSize: 8,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(31,27,22,0.4)',
            marginBottom: 6,
            fontWeight: 600,
          }}
        >
          {role}
        </p>

        {/* Icon + label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ opacity: visualState === 'idle' ? 0.45 : 0.85, flexShrink: 0 }}>
            <AgentIcon type={icon} size={24} />
          </div>
          <span
            style={{
              fontFamily: "'Special Elite', serif",
              fontSize: 13,
              color: '#1F1B16',
              lineHeight: 1.2,
              letterSpacing: '0.02em',
            }}
          >
            {label}
          </span>
        </div>

        {/* Badge */}
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: 'rgba(31,27,22,0.45)',
            lineHeight: 1.4,
            borderTop: '1px solid rgba(31,27,22,0.08)',
            paddingTop: 6,
            marginTop: 2,
          }}
        >
          {badge}
        </p>

        {/* In-process annotation */}
        {nestedAnnotation && (
          <div
            style={{
              marginTop: 6,
              padding: '4px 6px',
              backgroundColor: 'rgba(31,27,22,0.04)',
              borderLeft: '2px solid rgba(176,141,87,0.4)',
              borderRadius: '0 2px 2px 0',
            }}
          >
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: 'rgba(31,27,22,0.4)',
                letterSpacing: '0.02em',
              }}
            >
              ↳ {nestedAnnotation}
            </p>
          </div>
        )}

        {/* Vitals sparkline — stub for Phase 2, wired in Phase 6 */}
        {vitals && (
          <Sparkline data={vitals.rollingPassRate} />
        )}
      </div>

      {/* Bottom active indicator bar */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '20%',
            right: '20%',
            height: 2,
            backgroundColor: '#B08D57',
            borderRadius: '0 0 2px 2px',
            opacity: 0.6,
          }}
        />
      )}
    </div>
  );
});

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const h = 18;
  const w = 176;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${h - v * h}`)
    .join(' ');
  return (
    <div style={{ marginTop: 6 }}>
      <svg width={w} height={h} style={{ display: 'block', opacity: 0.5 }}>
        <polyline
          points={points}
          fill="none"
          stroke="#2F4A3B"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
