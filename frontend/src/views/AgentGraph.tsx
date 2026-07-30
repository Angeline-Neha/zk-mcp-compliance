import { useEffect, useState } from "react";
import { fetchAttestations, type Attestation } from "../lib/api";

interface TreeNode extends Attestation {
  children: TreeNode[];
}

function buildTree(attestations: Attestation[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(attestations.map((a) => [a.id, { ...a, children: [] }]));
  const roots: TreeNode[] = [];

  for (const node of nodes.values()) {
    if (node.parentAttestationId && nodes.has(node.parentAttestationId)) {
      nodes.get(node.parentAttestationId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  const statusColor = node.isRevoked ? "border-fail/50 text-fail" : node.isExpired ? "border-slate-structure text-slate-500" : "border-pass/40 text-pass";

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className={`panel p-3 mb-2 border ${statusColor} flex items-center gap-3`}>
        <div className="min-w-0 flex-1">
          <div className="font-mono-data text-sm text-slate-200 truncate">{node.agentId}</div>
          <div className="text-xs font-mono-data text-slate-500 truncate">
            {node.scope.action}
            {node.scope.limit !== undefined ? ` · limit ${node.scope.limit}` : ""}
          </div>
        </div>
        <div className="text-[10px] font-mono-data uppercase tracking-wide shrink-0">
          {node.isRevoked ? "revoked" : node.isExpired ? "expired" : "active"}
        </div>
      </div>
      {node.children.map((child) => (
        <Node key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function AgentGraph() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const attestations = await fetchAttestations();
    setTree(buildTree(attestations));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-line flex items-center justify-between">
        <h2 className="font-display font-semibold text-sm uppercase tracking-widest text-slate-300">
          Agent Graph
        </h2>
        <button
          onClick={load}
          className="text-xs font-mono-data text-data border border-data/40 rounded px-2 py-1 hover:bg-data/10 transition-colors"
        >
          refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {loading && <div className="text-slate-500 text-sm font-mono-data">Loading…</div>}
        {!loading && tree.length === 0 && (
          <div className="text-slate-500 text-sm font-mono-data">
            No attestations registered yet — run a task or an attack to see agents appear here.
          </div>
        )}
        {tree.map((root) => (
          <Node key={root.id} node={root} depth={0} />
        ))}
      </div>
    </div>
  );
}