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
  X,
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
      className={`w-64 p-3.5 rounded-[var(--radius)] bg-[var(--card)] border text-[var(--card-foreground)] transition-all shadow-sm select-none ${
        isLocked
          ? "border-[var(--primary)] shadow-[0_0_12px_rgba(96,96,96,0.2)] bg-[var(--card)]"
          : isBounded
          ? "border-[var(--destructive)] shadow-[0_0_12px_rgba(200,122,122,0.25)] bg-[var(--card)]"
          : "border-[var(--border)] hover:border-[var(--ring)]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[var(--primary)] !w-2.5 !h-2.5 !border-2 !border-[var(--card)]"
      />

      <div className="flex items-start justify-between pb-2 border-b border-[var(--border)]/60">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isLocked
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : isBounded
                ? "bg-[var(--destructive)]/20 text-[var(--destructive)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
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
            <h4 className="text-xs font-semibold text-[var(--card-foreground)] font-mono truncate" title={d.label}>
              {d.label}
            </h4>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono truncate block">
              {d.path}
            </span>
          </div>
        </div>

        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
            isLocked
              ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--border)]"
              : isBounded
              ? "bg-[var(--destructive)]/15 text-[var(--destructive)] border-[var(--destructive)]"
              : "bg-[var(--muted)] text-[var(--card-foreground)] border-[var(--border)]"
          }`}
        >
          {isLocked ? "LOCKED" : isBounded ? "BOUNDED" : "SAFE"}
        </span>
      </div>

      <div className="pt-2 space-y-1.5 text-[10px] font-mono">
        <div className="flex items-center justify-between text-[var(--muted-foreground)]">
          <span>AST Contract:</span>
          <span className="text-[var(--card-foreground)] font-semibold">{d.language}</span>
        </div>

        {isLocked && (
          <div className="flex items-center justify-between text-[var(--accent-foreground)] bg-[var(--accent)] px-2 py-1 rounded font-medium">
            <span>Locked by:</span>
            <span className="font-bold">{d.lockedBy}</span>
          </div>
        )}

        {isBounded && (
          <div className="flex items-center justify-between text-[var(--destructive)] bg-[var(--destructive)]/10 px-2 py-1 rounded">
            <span>Blast Radius:</span>
            <span className="font-bold">Wait for upstream</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[var(--muted-foreground)] pt-0.5 border-t border-[var(--border)]/40">
          <span>{d.importsCount} imports</span>
          <span>·</span>
          <span>{d.exportsCount} exports</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[var(--primary)] !w-2.5 !h-2.5 !border-2 !border-[var(--card)]"
      />
    </div>
  );
}

/* ------------------------------- Main Component ------------------------------- */

interface AstDependencyGraphProps {
  projectId?: string;
  projectName?: string;
}

export function AstDependencyGraph({ projectId, projectName }: AstDependencyGraphProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // AST Hierarchy Nodes (4 tiers from Root Orchestrator to Core to API Adapters to Leaves)
  const initialNodes: Node[] = useMemo(
    () => [
      // Level 1: Root Engine Orchestrator
      {
        id: "mod-root",
        type: "module",
        position: { x: 420, y: 30 },
        data: {
          label: "src/index.ts",
          path: "src/index.ts",
          language: "TypeScript",
          importsCount: 8,
          exportsCount: 5,
          status: "safe",
        },
      },

      // Level 2: Core Contracts (Level where locks cause blast radius down the tree)
      {
        id: "mod-auth-token",
        type: "module",
        position: { x: 120, y: 200 },
        data: {
          label: "src/auth/token_engine.ts",
          path: "src/auth/token_engine.ts",
          language: "TypeScript",
          importsCount: 4,
          exportsCount: 3,
          status: "locked",
          lockedBy: "Cursor IDE",
        },
      },
      {
        id: "mod-lock-table",
        type: "module",
        position: { x: 420, y: 200 },
        data: {
          label: "src/engine/lock_table.rs",
          path: "src/engine/lock_table.rs",
          language: "Rust",
          importsCount: 6,
          exportsCount: 4,
          status: "locked",
          lockedBy: "Copilot CLI",
        },
      },
      {
        id: "mod-db-client",
        type: "module",
        position: { x: 720, y: 200 },
        data: {
          label: "src/db/client.ts",
          path: "src/db/client.ts",
          language: "TypeScript",
          importsCount: 3,
          exportsCount: 2,
          status: "safe",
        },
      },

      // Level 3: Transitive Dependents (Bounded because parents are locked)
      {
        id: "mod-routes",
        type: "module",
        position: { x: 120, y: 370 },
        data: {
          label: "src/api/routes.ts",
          path: "src/api/routes.ts",
          language: "TypeScript",
          importsCount: 5,
          exportsCount: 1,
          status: "bounded",
        },
      },
      {
        id: "mod-parser",
        type: "module",
        position: { x: 420, y: 370 },
        data: {
          label: "crates/ast/src/parser.rs",
          path: "crates/ast/src/parser.rs",
          language: "Rust",
          importsCount: 7,
          exportsCount: 3,
          status: "bounded",
        },
      },

      // Level 4: Downstream Leaves
      {
        id: "mod-traversal",
        type: "module",
        position: { x: 420, y: 530 },
        data: {
          label: "crates/ast/src/traversal.rs",
          path: "crates/ast/src/traversal.rs",
          language: "Rust",
          importsCount: 2,
          exportsCount: 2,
          status: "safe",
        },
      },
      {
        id: "mod-session-types",
        type: "module",
        position: { x: 120, y: 530 },
        data: {
          label: "src/types/session.d.ts",
          path: "src/types/session.d.ts",
          language: "TypeScript",
          importsCount: 1,
          exportsCount: 6,
          status: "safe",
        },
      },
    ],
    []
  );

  // AST Direct & Transitive Edge Dependencies
  const initialEdges: Edge[] = useMemo(
    () => [
      // Root -> Level 2
      {
        id: "e-root-token",
        source: "mod-root",
        target: "mod-auth-token",
        animated: true,
        style: { stroke: "var(--primary)", strokeWidth: 1.75 },
      },
      {
        id: "e-root-locktable",
        source: "mod-root",
        target: "mod-lock-table",
        animated: true,
        style: { stroke: "var(--primary)", strokeWidth: 1.75 },
      },
      {
        id: "e-root-db",
        source: "mod-root",
        target: "mod-db-client",
        animated: false,
        style: { stroke: "var(--border)", strokeWidth: 1.5 },
      },

      // Level 2 -> Level 3 (Bounded Blast Radius Edges)
      {
        id: "e-token-routes",
        source: "mod-auth-token",
        target: "mod-routes",
        animated: true,
        label: "BLAST RADIUS",
        labelStyle: { fill: "var(--destructive)", fontSize: 9, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95, stroke: "var(--destructive)" },
        style: { stroke: "var(--destructive)", strokeWidth: 2, strokeDasharray: "4 4" },
      },
      {
        id: "e-locktable-parser",
        source: "mod-lock-table",
        target: "mod-parser",
        animated: true,
        label: "BLAST RADIUS",
        labelStyle: { fill: "var(--destructive)", fontSize: 9, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95, stroke: "var(--destructive)" },
        style: { stroke: "var(--destructive)", strokeWidth: 2, strokeDasharray: "4 4" },
      },

      // Level 3 -> Level 4
      {
        id: "e-parser-traversal",
        source: "mod-parser",
        target: "mod-traversal",
        animated: false,
        style: { stroke: "var(--border)", strokeWidth: 1.5 },
      },
      {
        id: "e-routes-session",
        source: "mod-routes",
        target: "mod-session-types",
        animated: false,
        style: { stroke: "var(--border)", strokeWidth: 1.5 },
      },
    ],
    []
  );

  const nodeTypes = useMemo(
    () => ({
      module: ModuleNode,
    }),
    []
  );

  return (
    <div className="w-full space-y-4">
      {/* Top Telemetry & Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 rounded-[var(--radius)] bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              AST Contracts
            </span>
            <span className="text-lg font-bold text-foreground">8 Modules</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center text-accent-foreground">
            <Network className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-[var(--radius)] bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Active Leases
            </span>
            <span className="text-lg font-bold text-foreground">2 Contract Locks</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center text-accent-foreground">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-[var(--radius)] bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Bounded Dependents
            </span>
            <span className="text-lg font-bold text-destructive">
              2 Files In Blast Radius
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-destructive/15 border border-destructive/30 flex items-center justify-center text-destructive">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-[var(--radius)] bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Max AST Depth
            </span>
            <span className="text-lg font-bold text-foreground">4 Tiers Tree</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center text-accent-foreground">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Canvas Container with Scoped Canvas Theme */}
      <div className="graph-canvas-theme relative w-full h-[650px] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden shadow-sm">
        {/* Graph Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-[var(--card)]/90 backdrop-blur-md px-3.5 py-2 rounded-[var(--radius)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted-foreground)]">
          <span className="text-[var(--card-foreground)] font-semibold">AST Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            Locked Contract
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--destructive)]" />
            Bounded (Blast Radius)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--muted-foreground)]" />
            Safe / Invariant
          </span>
        </div>

        <ReactFlow
          defaultNodes={initialNodes}
          defaultEdges={initialEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.4}
          maxZoom={1.5}
          onNodeClick={(_, node) => setSelectedNode(node)}
          className="bg-[var(--background)]"
        >
          <Background color="var(--border)" gap={24} size={1.2} />
          <Controls
            className="!bg-[var(--card)] !border-[var(--border)] !rounded-[var(--radius)] !overflow-hidden [&>button]:!bg-[var(--card)] [&>button]:!border-b-[var(--border)] [&>button]:!fill-[var(--foreground)] [&>button:hover]:!bg-[var(--muted)]"
          />
          <MiniMap
            nodeColor={(node) => {
              const d = node.data as any;
              if (d?.status === "locked") return "var(--primary)";
              if (d?.status === "bounded") return "var(--destructive)";
              return "var(--border)";
            }}
            maskColor="rgba(0, 0, 0, 0.25)"
            className="!bg-[var(--card)] !border-[var(--border)] !rounded-[var(--radius)]"
          />
        </ReactFlow>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-10 w-80 p-4 rounded-[var(--radius)] bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] text-xs font-mono space-y-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 text-[var(--card-foreground)]">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/60">
              <span className="text-[var(--primary)] font-bold uppercase tracking-wider text-[10px]">
                AST Contract Inspector
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] cursor-pointer p-0.5 rounded hover:bg-[var(--muted)] transition-colors"
                aria-label="Close inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block text-[10px]">MODULE ID</span>
              <span className="text-[var(--card-foreground)] font-semibold">
                {selectedNode.id}
              </span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block text-[10px]">AST METADATA</span>
              <pre className="text-[10px] text-[var(--card-foreground)] overflow-x-auto bg-[var(--background)] p-2 rounded border border-[var(--border)]">
                {JSON.stringify(selectedNode.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
