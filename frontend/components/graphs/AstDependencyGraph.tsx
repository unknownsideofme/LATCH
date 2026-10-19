"use client";

import React, { useMemo, useState } from "react";
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
} from "lucide-react";

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
      className={`w-64 p-3.5 rounded-xl bg-[#17191E] border transition-all shadow-md select-none ${
        isLocked
          ? "border-[#3ECF8E] shadow-[0_0_15px_rgba(62,207,142,0.15)] bg-[#17191E]"
          : isBounded
          ? "border-[#DA7756] shadow-[0_0_15px_rgba(218,119,86,0.15)] bg-[#1A1616]"
          : "border-[#282B30] hover:border-[#8B949E]/40"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#3ECF8E] !w-2.5 !h-2.5 !border-2 !border-[#12161A]"
      />

      <div className="flex items-start justify-between pb-2 border-b border-[#23272B]">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isLocked
                ? "bg-[#3ECF8E]/20 text-[#3ECF8E]"
                : isBounded
                ? "bg-[#DA7756]/20 text-[#DA7756]"
                : "bg-[#12161A] text-[#8B949E]"
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
            <h4 className="text-xs font-semibold text-[#EDEDED] font-mono truncate" title={d.label}>
              {d.label}
            </h4>
            <span className="text-[10px] text-[#8B949E] font-mono truncate block">
              {d.path}
            </span>
          </div>
        </div>

        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
            isLocked
              ? "bg-[#3ECF8E]/20 text-[#3ECF8E] border-[#3ECF8E]/40"
              : isBounded
              ? "bg-[#DA7756]/20 text-[#DA7756] border-[#DA7756]/40"
              : "bg-[#12161A] text-[#8B949E] border-[#282B30]"
          }`}
        >
          {isLocked ? "LOCKED" : isBounded ? "BOUNDED" : "SAFE"}
        </span>
      </div>

      <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-[#8B949E]">
        <span>
          {d.importsCount} imports · {d.exportsCount} exports
        </span>
        <span className="text-[#3ECF8E] font-semibold text-[10px] px-1 rounded bg-[#12161A]">
          {d.language}
        </span>
      </div>

      {isLocked && d.lockedBy && (
        <div className="mt-2 pt-1.5 border-t border-[#23272B] text-[10px] font-mono text-[#3ECF8E] flex items-center justify-between">
          <span>Lock Lease:</span>
          <span className="font-semibold">{d.lockedBy}</span>
        </div>
      )}

      {isBounded && (
        <div className="mt-2 pt-1.5 border-t border-[#23272B] text-[10px] font-mono text-[#DA7756] flex items-center justify-between">
          <span>Blast Radius:</span>
          <span>Pending parent release</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#3ECF8E] !w-2.5 !h-2.5 !border-2 !border-[#12161A]"
      />
    </div>
  );
}

const nodeTypes = {
  module: ModuleNode,
};

/* ------------------------------- Main AstDependencyGraph ------------------------------- */

export function AstDependencyGraph() {
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  // AST Module Hierarchy
  const initialNodes: Node[] = useMemo(
    () => [
      // Level 1: Root Gateway / Server (y: 30)
      {
        id: "mod-root",
        type: "module",
        position: { x: 420, y: 30 },
        data: {
          label: "index.ts",
          path: "src/index.ts",
          language: "TypeScript",
          importsCount: 6,
          exportsCount: 2,
          status: "safe",
        },
      },

      // Level 2: Core Subsystems (y: 190)
      {
        id: "mod-auth",
        type: "module",
        position: { x: 120, y: 190 },
        data: {
          label: "token_engine.ts",
          path: "src/auth/token_engine.ts",
          language: "TypeScript",
          importsCount: 3,
          exportsCount: 4,
          status: "locked",
          lockedBy: "Claude Code",
        },
      },
      {
        id: "mod-locktable",
        type: "module",
        position: { x: 420, y: 190 },
        data: {
          label: "lock_table.rs",
          path: "src/engine/lock_table.rs",
          language: "Rust",
          importsCount: 4,
          exportsCount: 8,
          status: "locked",
          lockedBy: "Cursor IDE",
        },
      },
      {
        id: "mod-db",
        type: "module",
        position: { x: 720, y: 190 },
        data: {
          label: "db_client.ts",
          path: "src/db/client.ts",
          language: "TypeScript",
          importsCount: 2,
          exportsCount: 5,
          status: "safe",
        },
      },

      // Level 3: Downstream Dependents & Blast Radius (y: 360)
      {
        id: "mod-routes",
        type: "module",
        position: { x: 120, y: 360 },
        data: {
          label: "routes.ts",
          path: "src/api/routes.ts",
          language: "TypeScript",
          importsCount: 5,
          exportsCount: 3,
          status: "bounded",
        },
      },
      {
        id: "mod-parser",
        type: "module",
        position: { x: 420, y: 360 },
        data: {
          label: "parser.rs",
          path: "crates/ast/src/parser.rs",
          language: "Rust",
          importsCount: 5,
          exportsCount: 12,
          status: "locked",
          lockedBy: "Codex CLI",
        },
      },
      {
        id: "mod-schema",
        type: "module",
        position: { x: 720, y: 360 },
        data: {
          label: "schema.prisma",
          path: "prisma/schema.prisma",
          language: "Prisma",
          importsCount: 0,
          exportsCount: 6,
          status: "safe",
        },
      },

      // Level 4: Deep Leaf AST Nodes (y: 530)
      {
        id: "mod-traversal",
        type: "module",
        position: { x: 420, y: 530 },
        data: {
          label: "traversal.rs",
          path: "crates/ast/src/traversal.rs",
          language: "Rust",
          importsCount: 3,
          exportsCount: 4,
          status: "bounded",
        },
      },
    ],
    []
  );

  // AST Dependency Edges
  const initialEdges: Edge[] = useMemo(
    () => [
      // Root -> Level 2
      {
        id: "e-root-auth",
        source: "mod-root",
        target: "mod-auth",
        animated: true,
        style: { stroke: "#3ECF8E", strokeWidth: 2 },
      },
      {
        id: "e-root-locktable",
        source: "mod-root",
        target: "mod-locktable",
        animated: true,
        style: { stroke: "#3ECF8E", strokeWidth: 2 },
      },
      {
        id: "e-root-db",
        source: "mod-root",
        target: "mod-db",
        style: { stroke: "#282B30", strokeWidth: 1.5 },
      },

      // Level 2 -> Level 3
      {
        id: "e-auth-routes",
        source: "mod-auth",
        target: "mod-routes",
        animated: true,
        style: { stroke: "#DA7756", strokeWidth: 2.2 },
      },
      {
        id: "e-locktable-parser",
        source: "mod-locktable",
        target: "mod-parser",
        animated: true,
        style: { stroke: "#3ECF8E", strokeWidth: 2 },
      },
      {
        id: "e-db-schema",
        source: "mod-db",
        target: "mod-schema",
        style: { stroke: "#282B30", strokeWidth: 1.5 },
      },

      // Level 3 -> Level 4
      {
        id: "e-parser-traversal",
        source: "mod-parser",
        target: "mod-traversal",
        animated: true,
        style: { stroke: "#DA7756", strokeWidth: 2.2 },
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Top Blast Radius Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-[#17191E] border border-[#282B30] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
              AST Modules
            </span>
            <span className="text-xl font-bold text-[#EDEDED] font-[var(--font-display)]">
              8 Contracts
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E]">
            <Network className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#17191E] border border-[#282B30] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
              Locked Branches
            </span>
            <span className="text-xl font-bold text-[#3ECF8E] font-[var(--font-display)]">
              3 Active Leases
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E]">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#17191E] border border-[#282B30] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
              Blast Radius Bounded
            </span>
            <span className="text-xl font-bold text-[#DA7756] font-[var(--font-display)]">
              2 Dependent Files
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#DA7756]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#17191E] border border-[#282B30] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
              Max AST Depth
            </span>
            <span className="text-xl font-bold text-[#EDEDED] font-[var(--font-display)]">
              4 Layers
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E]">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Interactive AST React Flow Canvas */}
      <div className="h-[580px] w-full rounded-xl bg-[#0F1115] border border-[#282B30] overflow-hidden relative shadow-inner">
        {/* Graph Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-[#17191E]/90 backdrop-blur-md px-3.5 py-2 rounded-lg border border-[#282B30] text-[11px] font-mono text-[#8B949E]">
          <span className="text-[#EDEDED] font-semibold">AST Propagation:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3ECF8E]" />
            Locked Node
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#DA7756]" />
            Blast Radius Bounded
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#282B30]" />
            Safe / Independent
          </span>
        </div>

        <ReactFlow
          defaultNodes={initialNodes}
          defaultEdges={initialEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.4}
          maxZoom={1.5}
          onNodeClick={(_, node) => setSelectedNode(node)}
          className="bg-[#0F1115]"
        >
          <Background color="#23272B" gap={24} size={1.2} />
          <Controls
            className="!bg-[#17191E] !border-[#282B30] !rounded-lg !overflow-hidden [&>button]:!bg-[#17191E] [&>button]:!border-b-[#282B30] [&>button]:!fill-[#EDEDED] [&>button:hover]:!bg-[#1C2024]"
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.data.status === "locked") return "#3ECF8E";
              if (node.data.status === "bounded") return "#DA7756";
              return "#282B30";
            }}
            maskColor="rgba(15, 17, 21, 0.75)"
            className="!bg-[#17191E] !border-[#282B30] !rounded-lg"
          />
        </ReactFlow>

        {/* Selected AST Node Details Drawer */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-10 w-80 p-4 rounded-xl bg-[#17191E]/95 backdrop-blur-md border border-[#3ECF8E]/40 text-xs font-mono space-y-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#23272B]">
              <span className="text-[#3ECF8E] font-bold uppercase tracking-wider text-[10px]">
                AST Contract Inspector
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[#8B949E] hover:text-[#EDEDED] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div>
              <span className="text-[#8B949E] block text-[10px]">MODULE</span>
              <span className="text-[#EDEDED] font-semibold">
                {selectedNode.data.label}
              </span>
            </div>
            <div>
              <span className="text-[#8B949E] block text-[10px]">PATH</span>
              <span className="text-[#EDEDED] text-[11px] block truncate">
                {selectedNode.data.path}
              </span>
            </div>
            <div>
              <span className="text-[#8B949E] block text-[10px]">AST METRICS</span>
              <div className="p-2 rounded bg-[#12161A] border border-[#23272B] space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Status:</span>
                  <span className="text-[#3ECF8E] font-bold uppercase">{selectedNode.data.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Language:</span>
                  <span className="text-[#EDEDED]">{selectedNode.data.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Blast Radius:</span>
                  <span className="text-[#DA7756]">{selectedNode.data.status === "bounded" ? "Contained" : "Isolated"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
