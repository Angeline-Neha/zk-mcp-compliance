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
    borderColor: 'rgba(10,51,35,0.4)',
    boxShadow: '0 1px 0 rgba(10,51,35,0.08)',
  },
  active: {
    borderColor: '#5E2750',
    boxShadow: '0 0 0 3px rgba(94,39,80,0.14)',
  },
  targeted: {
    borderColor: '#5E2750',
    boxShadow: '0 0 0 4px rgba(94,39,80,0.22)',
  },
  unauthorized: {
    borderColor: '#A8362C',
    borderStyle: 'dashed',
    boxShadow: 'none',
  },
};

export const Node = forwardRef<HTMLDivElement, NodeProps>(function Node(
  { id, label, port, badge, role, icon, visualState, nestedAnnotation, vitals, onClick, style, className },
  ref
) {
  const stateStyle = STATE_STYLES[visualState];

  return (
    <div
      ref={ref}
      id={`node-${id}`}
      onClick={onClick}
      className={className}
      style={{
        width: 200,
        backgroundColor: visualState === 'unauthorized' ? '#F8E6E2' : '#FFFFFF',
        border: '1.5px solid',
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        userSelect: 'none',
        fontFamily: 'var(--zk-sans)',
        ...stateStyle,
        ...style,
      }}
    >
      {/* Port tab — top-right corner */}
      {port && (
        <div
          style={{
            position: 'absolute',
            top: -1.5,
            right: -1.5,
            backgroundColor: '#0A3323',
            borderRadius: '0 8px 0 6px',
            padding: '3px 7px',
            lineHeight: 1,
          }}
        >
          <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, color: '#F7F4D5' }}>{port}</span>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: '11px 12px 10px' }}>
        <p style={{ fontSize: 11, color: 'rgba(10,51,35,0.6)', margin: '0 0 6px', fontWeight: 500 }}>{role}</p>

        {/* Icon + label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ opacity: visualState === 'idle' ? 0.6 : 1, flexShrink: 0 }}>
            <AgentIcon type={icon} size={24} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0A3323', lineHeight: 1.2 }}>{label}</span>
        </div>

        {/* Badge */}
        <p
          style={{
            fontFamily: 'var(--zk-mono)',
            fontSize: 10.5,
            color: 'rgba(10,51,35,0.7)',
            lineHeight: 1.4,
            borderTop: '1px dashed rgba(10,51,35,0.2)',
            paddingTop: 6,
            margin: '2px 0 0',
          }}
        >
          {badge}
        </p>

        {/* In-process annotation */}
        {nestedAnnotation && (
          <div
            style={{
              marginTop: 6,
              padding: '4px 7px',
              backgroundColor: 'rgba(94,39,80,0.08)',
              borderLeft: '2px solid #5E2750',
              borderRadius: '0 4px 4px 0',
            }}
          >
            <p style={{ fontFamily: 'var(--zk-mono)', fontSize: 9, letterSpacing: '-0.03em', color: 'rgba(10,51,35,0.75)', margin: 0, overflowWrap: 'anywhere' }}>
              ↳ {nestedAnnotation}
            </p>
          </div>
        )}

        {vitals && <Sparkline data={vitals.rollingPassRate} />}
      </div>
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
      <svg width={w} height={h} style={{ display: 'block', opacity: 0.8 }}>
        <polyline
          points={points}
          fill="none"
          stroke="#53662D"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
