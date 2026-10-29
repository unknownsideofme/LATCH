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
  Radio,
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
      className={`w-64 p-3.5 rounded-xl bg-[#18181b] border text-white transition-all shadow-xl select-none ${
        isLocked
          ? "border-amber-500/60 shadow-[0_0_16px_rgba(245,158,11,0.25)] bg-[#18181b]"
          : isBounded
          ? "border-red-500/60 shadow-[0_0_16px_rgba(239,68,68,0.25)] bg-[#18181b]"
          : "border-[#27272a] hover:border-[#ffe0c2]/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#ffe0c2] !w-3 !h-3 !border-2 !border-[#18181b]"
      />

      <div className="flex items-start justify-between pb-2.5 border-b border-[#27272a]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isLocked
                ? "bg-amber-500/15 text-amber-400"
                : isBounded
                ? "bg-red-500/15 text-red-400"
                : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {isLocked ? (
              <Lock className="w-4 h-4" />
            ) : isBounded ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Code2 className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white font-mono truncate" title={d.label}>
              {d.label}
            </h4>
            <span className="text-[10px] text-[#a1a1aa] font-mono truncate block">
              {d.path}
            </span>
          </div>
        </div>

        <span
          className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
            isLocked
              ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
              : isBounded
              ? "bg-red-500/15 text-red-400 border-red-500/40 animate-pulse"
              : "bg-neutral-800 text-neutral-400 border-neutral-700"
          }`}
        >
          {isLocked ? "LOCKED" : isBounded ? "BOUNDED" : "SAFE"}
        </span>
      </div>

      <div className="pt-2.5 space-y-1.5 text-[11px] font-mono">
        <div className="flex items-center justify-between text-[#a1a1aa]">
          <span>AST Contract:</span>
          <span className="text-white font-semibold">{d.language}</span>
        </div>

        <div className="flex items-center justify-between text-[#a1a1aa]">
          <span>Inbound Imports:</span>
          <span className="text-[#ffe0c2] font-semibold">{d.importsCount} references</span>
        </div>

        <div className="flex items-center justify-between text-[#a1a1aa]">
          <span>Export Symbols:</span>
          <span className="text-[#ffe0c2] font-semibold">{d.exportsCount} symbols</span>
        </div>

        {isLocked && d.lockedBy && (
          <div className="pt-1.5 border-t border-[#27272a] flex items-center justify-between text-amber-400 font-semibold">
            <span>Locked Lease:</span>
            <span className="truncate max-w-[130px]">{d.lockedBy}</span>
          </div>
        )}

        {isBounded && (
          <div className="pt-1.5 border-t border-[#27272a] text-[10px] text-red-400 font-semibold">
            Included in Lock Blast Radius
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#ffe0c2] !w-3 !h-3 !border-2 !border-[#18181b]"
      />
    </div>
  );
}

/* ------------------------------- Main Component ------------------------------- */

export function AstDependencyGraph() {
  const { dashboard, selectedProjectId } = useLatch();
  const [graphData, setGraphData] = useState<Dashboard["graph"] | null>(dashboard?.graph || null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [activeLocks, setActiveLocks] = useState<string[]>([]);

  // Sync graph data from context or fallback fetch
  useEffect(() => {
    if (dashboard?.graph?.nodes?.length) {
      setGraphData(dashboard.graph);
    }
  }, [dashboard?.graph]);

  useEffect(() => {
    const id = selectedProjectId || dashboard?.project.id;
    if (!id) return;
    if (graphData?.nodes?.length) return;

    fetch(apiUrl(`/api/projects/${id}/graph`))
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (g?.nodes?.length) setGraphData(g);
      })
      .catch(() => undefined);
  }, [selectedProjectId, dashboard?.project.id, graphData?.nodes?.length]);

  // Track active file locks from dashboard
  useEffect(() => {
    if (!dashboard?.locks) return;
    const lockedFiles = dashboard.locks
      .filter((l) => !l.released)
      .map((l) => (l.filePath.includes("::") ? l.filePath.split("::")[1] : l.filePath));
    setActiveLocks(lockedFiles);
  }, [dashboard?.locks]);

  const { nodes, edges, blastRadiusCount, cycleCount, lockDepth } = useMemo(() => {
    if (!graphData?.nodes?.length) {
      return { nodes: [], edges: [], blastRadiusCount: 0, cycleCount: 0, lockDepth: 0 };
    }

    const rawNodes = graphData.nodes;
    const rawEdges = graphData.edges || [];
    const cycles = graphData.cycles || [];
    const lockDepthVal = graphData.lockDepth ?? 1;

    // Identify bounded nodes within lock depth
    const lockedSet = new Set(activeLocks);
    const boundedSet = new Set<string>();

    rawNodes.forEach((n) => {
      if (lockedSet.has(n.id) || n.locked) {
        lockedSet.add(n.id);
        (n.dependents || []).forEach((dep) => boundedSet.add(dep));
      }
    });

    // Layout configuration
    const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(rawNodes.length))));
    const spacingX = 320;
    const spacingY = 220;

    const generatedNodes: Node[] = rawNodes.map((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isLocked = lockedSet.has(n.id) || Boolean(n.locked);
      const isBounded = !isLocked && boundedSet.has(n.id);

      const shortLabel = n.id.split("/").pop() || n.id;

      return {
        id: n.id,
        type: "module",
        position: { x: 40 + col * spacingX, y: 40 + row * spacingY },
        data: {
          label: shortLabel,
          path: n.id,
          language: n.id.endsWith(".ts") || n.id.endsWith(".tsx") ? "TypeScript" : n.id.endsWith(".js") ? "JavaScript" : n.id.endsWith(".rs") ? "Rust" : "Source",
          importsCount: (n.dependents || []).length,
          exportsCount: 4,
          status: isLocked ? "locked" : isBounded ? "bounded" : "safe",
          lockedBy: isLocked ? "Latch Mutex Holder" : undefined,
        },
      };
    });

    const generatedEdges: Edge[] = rawEdges.map((e, idx) => {
      const isSourceLocked = lockedSet.has(e.from);
      const isTargetLocked = lockedSet.has(e.to);
      const isAffected = isSourceLocked || isTargetLocked;

      return {
        id: `ast-edge-${idx}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        animated: isAffected,
        style: {
          stroke: isSourceLocked && isTargetLocked ? "#ef4444" : isAffected ? "#ffe0c2" : "#3f3f46",
          strokeWidth: isAffected ? 2.5 : 1.2,
        },
      };
    });

    return {
      nodes: generatedNodes,
      edges: generatedEdges,
      blastRadiusCount: boundedSet.size,
      cycleCount: cycles.length,
      lockDepth: lockDepthVal,
    };
  }, [graphData, activeLocks]);

  const nodeTypes = useMemo(
    () => ({
      module: ModuleNode,
    }),
    []
  );

  return (
    <div className="space-y-4">
      {/* High-Contrast KPI Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#18181b] border border-[#27272a] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider block">
              Source Modules
            </span>
            <span className="text-2xl font-bold text-white tracking-tight">
              {graphData?.fileCount ?? nodes.length} Files
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#ffe0c2]/10 border border-[#ffe0c2]/20 flex items-center justify-center text-[#ffe0c2]">
            <FileCode className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#18181b] border border-[#27272a] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider block">
              Import Graph Edges
            </span>
            <span className="text-2xl font-bold text-emerald-400 tracking-tight">
              {graphData?.edgeCount ?? edges.length} Edges
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <GitBranch className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#18181b] border border-[#27272a] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider block">
              Blast Radius
            </span>
            <span className="text-2xl font-bold text-red-400 tracking-tight">
              {blastRadiusCount} Bounded
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#18181b] border border-[#27272a] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider block">
              AST Depth / Cycles
            </span>
            <span className="text-2xl font-bold text-[#ffe0c2] tracking-tight">
              Depth {lockDepth} &bull; {cycleCount} Cycles
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#ffe0c2]/10 border border-[#ffe0c2]/20 flex items-center justify-center text-[#ffe0c2]">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Canvas Container */}
      <div className="relative w-full h-[650px] rounded-xl border border-[#27272a] overflow-hidden shadow-2xl bg-[#111111]">
        {/* Graph Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-3 bg-[#18181b]/95 backdrop-blur-md px-3.5 py-2 rounded-lg border border-[#27272a] text-xs font-mono text-[#a1a1aa] shadow-xl">
          <span className="text-white font-semibold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>AST Boundary:</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
            <span className="text-neutral-200">Locked Contract</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]" />
            <span className="text-neutral-200">Bounded (Blast Radius)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            <span className="text-neutral-200">Safe / Invariant</span>
          </span>
        </div>

        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#a1a1aa] font-mono text-xs">
            <Network className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-white font-semibold">Tree-sitter AST Mapping...</p>
            <p className="text-[11px] opacity-75 mt-1">Files automatically populate as code changes occur.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
            maxZoom={1.5}
            onNodeClick={(_, node) => setSelectedNode(node)}
            className="bg-[#111111]"
          >
            <Background color="#27272a" gap={20} size={1} />
            <Controls
              className="!bg-[#18181b] !border-[#27272a] !rounded-lg !overflow-hidden [&>button]:!bg-[#18181b] [&>button]:!border-b-[#27272a] [&>button]:!fill-white [&>button:hover]:!bg-[#27272a]"
            />
            <MiniMap
              nodeColor={(node) => {
                const d = node.data as { status?: string };
                if (d?.status === "locked") return "#f59e0b";
                if (d?.status === "bounded") return "#ef4444";
                return "#22c55e";
              }}
              maskColor="rgba(0, 0, 0, 0.7)"
              className="!bg-[#18181b] !border-[#27272a] !rounded-lg"
            />
          </ReactFlow>
        )}

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-10 w-80 p-4 rounded-xl bg-[#18181b]/95 backdrop-blur-md border border-[#27272a] text-xs font-mono space-y-2 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <span className="text-[#ffe0c2] font-bold uppercase tracking-wider text-[10.5px]">
                AST Contract Inspector
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[#a1a1aa] hover:text-white cursor-pointer p-1 rounded hover:bg-[#27272a] transition-colors"
                aria-label="Close inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <span className="text-[#a1a1aa] block text-[10px] uppercase">Module ID</span>
              <span className="text-white font-semibold">
                {selectedNode.id}
              </span>
            </div>
            <div>
              <span className="text-[#a1a1aa] block text-[10px] uppercase">AST Metadata</span>
              <pre className="text-[10.5px] text-[#ffe0c2] overflow-x-auto bg-[#111111] p-2.5 rounded-lg border border-[#27272a] mt-1 max-h-48">
                {JSON.stringify(selectedNode.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
