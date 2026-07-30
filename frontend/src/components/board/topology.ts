export type NodeId =
  | 'gateway'
  | 'support-agent'
  | 'admin-agent'
  | 'issuer'
  | 'finance'
  | 'compliance'
  | 'admin-mcp';

export type EdgeId =
  | 'gateway->support-agent'
  | 'gateway->admin-agent'
  | 'support-agent->issuer'
  | 'support-agent->finance'
  | 'finance->compliance'
  | 'admin-agent->admin-mcp';

export type NodeVisualState = 'idle' | 'active' | 'targeted' | 'unauthorized';
export type ThreadState = 'idle' | 'pending' | 'pass' | 'fail' | 'no-path';
export type StampState = 'pass' | 'fail' | 'counting';
export type CheckpointState = 'hidden' | 'pending' | 'pass' | 'fail';

export interface NodeDef {
  id: NodeId;
  label: string;
  port?: string;
  badge: string;
  role: string;
  icon: 'gateway' | 'support' | 'admin-agent' | 'issuer' | 'finance' | 'compliance' | 'admin-mcp';
  /** If true, rendered as a nested annotation inside another card (no separate thread) */
  nested?: NodeId;
}

export interface EdgeDef {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  /** Call signature shown on the Telegram popup mid-flight */
  callSig?: string;
  /** 0–1 along the path where the checkpoint sits */
  checkpointAt?: number;
}

export const NODES: NodeDef[] = [
  {
    id: 'gateway',
    label: 'Demo Gateway',
    port: ':4006',
    badge: 'entry point · owns session',
    role: 'INTAKE & ROUTING',
    icon: 'gateway',
  },
  {
    id: 'support-agent',
    label: 'Support Agent',
    port: ':4004',
    badge: 'handles issue_refund',
    role: 'REFUNDS DESK',
    icon: 'support',
  },
  {
    id: 'admin-agent',
    label: 'Admin Agent',
    port: ':4005',
    badge: 'handles delete/export',
    role: 'RECORDS & DELETION',
    icon: 'admin-agent',
  },
  {
    id: 'issuer',
    label: 'Issuer Service',
    port: ':4001',
    badge: 'issues, verifies Proof 1',
    role: 'NOTARY & CREDENTIALING',
    icon: 'issuer',
  },
  {
    id: 'finance',
    label: 'Finance MCP',
    port: ':4003',
    badge: 'runs the gate · executes refunds',
    role: 'THE VAULT',
    icon: 'finance',
  },
  {
    id: 'compliance',
    label: 'Compliance Prover',
    port: ':4002',
    badge: 'generates Groth16 proofs',
    role: 'THE CRIME LAB',
    icon: 'compliance',
  },
  {
    id: 'admin-mcp',
    label: 'Admin MCP',
    port: ':4005',
    badge: 'runs the gate for deletions',
    role: 'THE ARCHIVES',
    icon: 'admin-mcp',
  },
];

export const EDGES: EdgeDef[] = [
  {
    id: 'gateway->support-agent',
    from: 'gateway',
    to: 'support-agent',
    callSig: 'handle_ticket(sessionId, orderRef, justification, attestationId)',
    checkpointAt: 0.5,
  },
  {
    id: 'gateway->admin-agent',
    from: 'gateway',
    to: 'admin-agent',
    callSig: 'handle_ticket(ticketText, delegatedAttestationId)',
  },
  {
    id: 'support-agent->issuer',
    from: 'support-agent',
    to: 'issuer',
    callSig: 'POST /intent-commitment · POST /challenge · GET /verify',
    checkpointAt: 0.5,
  },
  {
    id: 'support-agent->finance',
    from: 'support-agent',
    to: 'finance',
    callSig: 'lookup_order(orderRef) · issue_refund(...proofs)',
    checkpointAt: 0.55,
  },
  {
    id: 'finance->compliance',
    from: 'finance',
    to: 'compliance',
    callSig: 'POST /prove/refundPolicy',
  },
  {
    id: 'admin-agent->admin-mcp',
    from: 'admin-agent',
    to: 'admin-mcp',
    callSig: 'lookup_account · issue_deletion(...proofs)',
  },
];
