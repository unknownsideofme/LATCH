"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Network,
  FileCode,
  Shield,
  AlertTriangle,
  Lock,
  GitBranch,
  Layers,
  Sparkles,
  ArrowRight,
  Code2,
  X,
} from "lucide-react";
import { useLatch } from "@/lib/LatchContext";
import { apiUrl } from "@/lib/api";
import type { Dashboard } from "@/lib/types";

/* ------------------------------- Custom Module Node Component ------------------------------- */

function ModuleNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    path: string;
    language: string;
    importsCount: number;
    exportsCount: number;
    status: "locked" | "bounded" | "safe";
    lockedBy?: string;
  };

  const isLocked = d.status === "locked";
  const isBounded = d.status === "bounded";

  return (
    <div
      className={`w-64 p-3.5 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border text-[var(--card-foreground,#302925)] transition-all shadow-sm select-none ${
        isLocked
          ? "border-[var(--primary,#7A3438)] shadow-[0_0_12px_rgba(122,52,56,0.2)] bg-[var(--card,#FFFCF8)]"
          : isBounded
          ? "border-[var(--red,#B53F3F)] shadow-[0_0_12px_rgba(181,63,63,0.25)] bg-[var(--card,#FFFCF8)]"
          : "border-[var(--border,#DDD3C9)] hover:border-[var(--primary,#7A3438)]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[var(--primary,#7A3438)] !w-2.5 !h-2.5 !border-2 !border-[var(--card,#FFFCF8)]"
      />

      <div className="flex items-start justify-between pb-2 border-b border-[var(--border,#DDD3C9)]/60">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isLocked
                ? "bg-[var(--accent-hover,#64292D)] text-[var(--accent-ink,#FFFFFF)]"
                : isBounded
                ? "bg-[var(--red-dim,#FBEBED)] text-[var(--red,#B53F3F)]"
                : "bg-[var(--sunken,#EAE3DA)] text-[var(--muted,#776F67)]"
            }`}
          >
            {isLocked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : isBounded ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <Code2 className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-[var(--card-foreground,#302925)] font-mono truncate" title={d.label}>
              {d.label}
            </h4>
            <span className="text-[10px] text-[var(--muted,#776F67)] font-mono truncate block">
              {d.path}
            </span>
          </div>
        </div>

        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
            isLocked
              ? "bg-[var(--primary,#7A3438)] text-[var(--primary-foreground,#FFFFFF)] border-[var(--primary,#7A3438)]"
              : isBounded
              ? "bg-[var(--red-dim,#FBEBED)] text-[var(--red,#B53F3F)] border-[var(--red,#B53F3F)]"
              : "bg-[var(--sunken,#EAE3DA)] text-[var(--card-foreground,#302925)] border-[var(--border,#DDD3C9)]"
          }`}
        >
          {isLocked ? "LOCKED" : isBounded ? "BOUNDED" : "SAFE"}
        </span>
      </div>

      <div className="pt-2 space-y-1.5 text-[10px] font-mono">
        <div className="flex items-center justify-between text-[var(--muted,#776F67)]">
          <span>AST Contract:</span>
          <span className="text-[var(--card-foreground,#302925)] font-semibold">{d.language}</span>
        </div>

        {isLocked && (
          <div className="flex items-center justify-between text-[var(--accent-ink,#FFFFFF)] bg-[var(--primary,#7A3438)] px-2 py-1 rounded font-medium">
            <span>Locked by:</span>
            <span className="font-bold">{d.lockedBy || "Agent"}</span>
          </div>
        )}

        {isBounded && (
          <div className="flex items-center justify-between text-[var(--red,#B53F3F)] bg-[var(--red-dim,#FBEBED)] px-2 py-1 rounded">
            <span>Blast Radius:</span>
            <span className="font-bold">Wait for upstream</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[var(--muted,#776F67)] pt-0.5 border-t border-[var(--border,#DDD3C9)]/40">
          <span>{d.importsCount} imports</span>
          <span>·</span>
          <span>{d.exportsCount} dependents</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[var(--primary,#7A3438)] !w-2.5 !h-2.5 !border-2 !border-[var(--card,#FFFCF8)]"
      />
    </div>
  );
}

/* ------------------------------- Helper Functions ------------------------------- */

function detectLanguage(filePath: string): string {
  const ext = (filePath.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "TypeScript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "JavaScript";
    case "rs":
      return "Rust";
    case "py":
      return "Python";
    case "go":
      return "Go";
    case "json":
      return "JSON";
    case "md":
      return "Markdown";
    default:
      return ext.toUpperCase() || "Source";
  }
}

/* ------------------------------- Main Component ------------------------------- */

export function AstDependencyGraph() {
  const { dashboard, selectedProjectId } = useLatch();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [fetchedGraph, setFetchedGraph] = useState<NonNullable<Dashboard["graph"]> | null>(null);

  // Fallback fetch if dashboard graph is empty
  useEffect(() => {
    const id = selectedProjectId || dashboard?.project?.id;
    if (!id || dashboard?.graph?.nodes?.length) return;

    fetch(apiUrl(`/api/projects/${id}/graph`))
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (g?.nodes) setFetchedGraph(g);
      })
      .catch(() => undefined);
  }, [selectedProjectId, dashboard?.project?.id, dashboard?.graph?.nodes?.length]);

  const liveGraph = dashboard?.graph?.nodes?.length ? dashboard.graph : fetchedGraph;

  // Build nodes and edges from live AST
  const { nodes, edges, blastRadiusCount, lockedContractsCount } = useMemo(() => {
    const rawNodes = liveGraph?.nodes || [];
    const rawEdges = liveGraph?.edges || [];
    const activeLocks = dashboard?.locks || [];

    // Map locked files
    const lockMap = new Map<string, string>();
    activeLocks.forEach((l) => {
      const p = (l.filePath || "").toLowerCase().replace(/\\/g, "/");
      const holderLabel = l.holder?.label || l.agentId;
      lockMap.set(p, holderLabel);
    });

    // Check bounded nodes (blast radius)
    const lockedNodeIds = new Set<string>();
    rawNodes.forEach((n) => {
      const p = n.id.toLowerCase().replace(/\\/g, "/");
      if (n.locked || lockMap.has(p)) {
        lockedNodeIds.add(n.id);
      }
    });

    // Find all downstream dependents of locked nodes
    const boundedNodeIds = new Set<string>();
    const queue = Array.from(lockedNodeIds);
    const visited = new Set<string>(lockedNodeIds);

    // Build adjacency list for dependents
    const adj = new Map<string, string[]>();
    rawEdges.forEach((e) => {
      const list = adj.get(e.from) || [];
      list.push(e.to);
      adj.set(e.from, list);
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = adj.get(current) || [];
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          visited.add(dep);
          boundedNodeIds.add(dep);
          queue.push(dep);
        }
      }
    }

    // Layout nodes into a topological/grid arrangement
    const generatedNodes: Node[] = [];
    const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(rawNodes.length || 1))));

    rawNodes.forEach((n, idx) => {
      const p = n.id.toLowerCase().replace(/\\/g, "/");
      const isLocked = lockedNodeIds.has(n.id) || n.locked || lockMap.has(p);
      const isBounded = !isLocked && boundedNodeIds.has(n.id);
      const lockedBy = lockMap.get(p) || (n.locked ? "Active Agent" : undefined);

      const col = idx % cols;
      const row = Math.floor(idx / cols);

      generatedNodes.push({
        id: `ast-${n.id}`,
        type: "module",
        position: { x: 50 + col * 310, y: 50 + row * 220 },
        data: {
          label: n.id.split("/").pop() || n.id,
          path: n.id,
          language: detectLanguage(n.id),
          importsCount: n.imports?.length || 0,
          exportsCount: n.dependents?.length || 0,
          status: isLocked ? "locked" : isBounded ? "bounded" : "safe",
          lockedBy,
        },
      });
    });

    // Generate edges
    const generatedEdges: Edge[] = [];
    rawEdges.forEach((e, idx) => {
      const isFromLocked = lockedNodeIds.has(e.from);
      const isToBounded = boundedNodeIds.has(e.to);
      const isBlastRadius = isFromLocked && isToBounded;

      generatedEdges.push({
        id: `ast-edge-${idx}-${e.from}-${e.to}`,
        source: `ast-${e.from}`,
        target: `ast-${e.to}`,
        animated: isBlastRadius,
        label: isBlastRadius ? "BLAST RADIUS" : undefined,
        labelStyle: {
          fill: "var(--red,#B53F3F)",
          fontSize: 9,
          fontFamily: "var(--mono)",
        },
        labelBgStyle: {
          fill: "var(--card,#FFFCF8)",
          fillOpacity: 0.95,
          stroke: "var(--red,#B53F3F)",
        },
        style: {
          stroke: isBlastRadius ? "var(--red,#B53F3F)" : isFromLocked ? "var(--primary,#7A3438)" : "var(--border,#DDD3C9)",
          strokeWidth: isBlastRadius ? 2 : 1.5,
          strokeDasharray: isBlastRadius ? "4 4" : undefined,
        },
      });
    });

    return {
      nodes: generatedNodes,
      edges: generatedEdges,
      blastRadiusCount: boundedNodeIds.size,
      lockedContractsCount: lockedNodeIds.size,
    };
  }, [liveGraph, dashboard?.locks]);

  const nodeTypes = useMemo(
    () => ({
      module: ModuleNode,
    }),
    []
  );

  const fileCount = liveGraph?.fileCount ?? liveGraph?.nodes?.length ?? 0;
  const cycleCount = liveGraph?.cycles?.length || 0;
  const lockDepth = liveGraph?.lockDepth ?? 2;

  return (
    <div className="w-full space-y-4">
      {/* Top Telemetry & Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-[var(--muted,#776F67)] uppercase tracking-wider block">
              AST Modules
            </span>
            <span className="text-lg font-bold text-[var(--text,#302925)]">
              {fileCount} Files
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--sunken,#EAE3DA)] border border-[var(--border,#DDD3C9)] flex items-center justify-center text-[var(--primary,#7A3438)]">
            <Network className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-[var(--muted,#776F67)] uppercase tracking-wider block">
              Active Leases
            </span>
            <span className="text-lg font-bold text-[var(--text,#302925)]">
              {lockedContractsCount} Contract Lock{lockedContractsCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--sunken,#EAE3DA)] border border-[var(--border,#DDD3C9)] flex items-center justify-center text-[var(--primary,#7A3438)]">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-[var(--muted,#776F67)] uppercase tracking-wider block">
              Blast Radius
            </span>
            <span className="text-lg font-bold text-[var(--red,#B53F3F)]">
              {blastRadiusCount} Bounded
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--red-dim,#FBEBED)] border border-[var(--red,#B53F3F)]/30 flex items-center justify-center text-[var(--red,#B53F3F)]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-[var(--muted,#776F67)] uppercase tracking-wider block">
              AST Depth / Cycles
            </span>
            <span className="text-lg font-bold text-[var(--text,#302925)]">
              Depth {lockDepth} · {cycleCount} Cycles
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--sunken,#EAE3DA)] border border-[var(--border,#DDD3C9)] flex items-center justify-center text-[var(--primary,#7A3438)]">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Canvas Container with Scoped Canvas Theme */}
      <div className="relative w-full h-[620px] rounded-[var(--radius,8px)] border border-[var(--border,#DDD3C9)] overflow-hidden shadow-sm bg-[var(--bg,#F2EEE8)]">
        {/* Graph Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-[var(--card,#FFFCF8)]/95 backdrop-blur-md px-3.5 py-2 rounded-[var(--radius,8px)] border border-[var(--border,#DDD3C9)] text-[11px] font-mono text-[var(--muted,#776F67)] shadow-sm">
          <span className="text-[var(--text,#302925)] font-semibold">AST Boundary:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--primary,#7A3438)]" />
            Locked Contract
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--red,#B53F3F)]" />
            Bounded (Blast Radius)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--green,#34734B)]" />
            Safe / Invariant
          </span>
        </div>

        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[var(--muted,#776F67)] font-mono text-xs">
            <Network className="w-8 h-8 mb-2 opacity-50" />
            <p>No Tree-sitter AST nodes mapped yet for this workspace.</p>
            <p className="text-[11px] opacity-75 mt-1">Files will automatically populate once inspected or edited by an agent.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.25}
            maxZoom={1.5}
            onNodeClick={(_, node) => setSelectedNode(node)}
            className="bg-[var(--bg,#F2EEE8)]"
          >
            <Background color="var(--border,#DDD3C9)" gap={24} size={1.2} />
            <Controls
              className="!bg-[var(--card,#FFFCF8)] !border-[var(--border,#DDD3C9)] !rounded-[var(--radius,8px)] !overflow-hidden [&>button]:!bg-[var(--card,#FFFCF8)] [&>button]:!border-b-[var(--border,#DDD3C9)] [&>button]:!fill-[var(--text,#302925)] [&>button:hover]:!bg-[var(--sunken,#EAE3DA)]"
            />
            <MiniMap
              nodeColor={(node) => {
                const d = node.data as any;
                if (d?.status === "locked") return "var(--primary,#7A3438)";
                if (d?.status === "bounded") return "var(--red,#B53F3F)";
                return "var(--green,#34734B)";
              }}
              maskColor="rgba(0, 0, 0, 0.15)"
              className="!bg-[var(--card,#FFFCF8)] !border-[var(--border,#DDD3C9)] !rounded-[var(--radius,8px)]"
            />
          </ReactFlow>
        )}

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-10 w-80 p-4 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)]/95 backdrop-blur-md border border-[var(--border,#DDD3C9)] text-xs font-mono space-y-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 text-[var(--card-foreground,#302925)]">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border,#DDD3C9)]/60">
              <span className="text-[var(--primary,#7A3438)] font-bold uppercase tracking-wider text-[10px]">
                AST Contract Inspector
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[var(--muted,#776F67)] hover:text-[var(--card-foreground,#302925)] cursor-pointer p-0.5 rounded hover:bg-[var(--sunken,#EAE3DA)] transition-colors"
                aria-label="Close inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <span className="text-[var(--muted,#776F67)] block text-[10px]">MODULE ID</span>
              <span className="text-[var(--card-foreground,#302925)] font-semibold">
                {selectedNode.id}
              </span>
            </div>
            <div>
              <span className="text-[var(--muted,#776F67)] block text-[10px]">AST METADATA</span>
              <pre className="text-[10px] text-[var(--card-foreground,#302925)] overflow-x-auto bg-[var(--bg,#F2EEE8)] p-2 rounded border border-[var(--border,#DDD3C9)]">
                {JSON.stringify(selectedNode.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
