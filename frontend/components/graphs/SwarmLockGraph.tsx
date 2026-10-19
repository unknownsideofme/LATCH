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
import Image from "next/image";
import {
  Lock,
  Clock,
  Shield,
  AlertTriangle,
  User,
  Bot,
  FileCode,
  Activity,
  Layers,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react";

/* ------------------------------- Custom Node Components ------------------------------- */

// 1. Human Operator Node
function HumanNode({ data }: NodeProps) {
  const d = data as {
    login: string;
    name: string;
    role: string;
    online: boolean;
    agentsCount: number;
  };

  return (
    <div className="w-56 p-3 rounded-[var(--radius)] bg-[var(--card)] border border-[var(--border)] text-[var(--card-foreground)] hover:border-[var(--ring)] transition-all shadow-sm select-none">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[var(--accent)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-foreground)] font-bold text-xs">
            {d.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--card-foreground)] flex items-center gap-1.5 font-sans">
              <span>{d.name}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  d.online ? "bg-[var(--primary)] animate-pulse" : "bg-[var(--muted-foreground)]"
                }`}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">@{d.login}</span>
          </div>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] border border-[var(--border)]">
          {d.agentsCount} agents
        </span>
      </div>
      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-[var(--muted-foreground)]">
        <span>Role:</span>
        <span className="text-[var(--card-foreground)] font-semibold">{d.role}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[var(--primary)] !w-2.5 !h-2.5 !border-2 !border-[var(--card)]"
      />
    </div>
  );
}

// 2. AI Agent Node
function AgentNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    model: string;
    status: "hold" | "clash" | "read" | "idle";
    task: string;
    img: string;
  };

  const statusConfig = {
    hold: { text: "Editing lease", color: "text-[var(--primary)]", bg: "bg-[var(--accent)]", border: "border-[var(--border)]" },
    clash: { text: "Contested", color: "text-[var(--destructive)]", bg: "bg-[var(--destructive)]/15", border: "border-[var(--destructive)]" },
    read: { text: "Reading AST", color: "text-[var(--secondary-foreground)]", bg: "bg-[var(--secondary)]", border: "border-[var(--border)]" },
    idle: { text: "Idle", color: "text-[var(--muted-foreground)]", bg: "bg-[var(--muted)]", border: "border-[var(--border)]" },
  }[d.status];

  return (
    <div className="w-60 p-3 rounded-[var(--radius)] bg-[var(--card)] border border-[var(--border)] text-[var(--card-foreground)] hover:border-[var(--ring)] transition-all shadow-sm select-none relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[var(--muted-foreground)] !w-2.5 !h-2.5 !border-2 !border-[var(--card)]"
      />
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--background)] border border-[var(--border)] p-1 flex items-center justify-center shrink-0">
            <Image
              src={d.img}
              alt={d.label}
              width={20}
              height={20}
              className="object-contain"
            />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[var(--card-foreground)] font-sans">{d.label}</h4>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{d.model}</span>
          </div>
        </div>
        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
        >
          {statusConfig.text}
        </span>
      </div>

      <div className="pt-2 text-[11px] font-mono text-[var(--muted-foreground)] truncate" title={d.task}>
        &gt; {d.task}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[var(--primary)] !w-2.5 !h-2.5 !border-2 !border-[var(--card)]"
      />
    </div>
  );
}

// 3. File Mutex Lease Node
function FileNode({ data }: NodeProps) {
  const d = data as {
    path: string;
    holder: string | null;
    status: "locked" | "contested" | "free";
    secondsLeft: number;
    readersCount: number;
  };

  const isLocked = d.status === "locked";
  const isContested = d.status === "contested";

  return (
    <div
      className={`w-64 p-3.5 rounded-[var(--radius)] bg-[var(--card)] border text-[var(--card-foreground)] transition-all shadow-sm select-none ${
        isContested
          ? "border-[var(--destructive)] shadow-[0_0_12px_rgba(200,122,122,0.25)]"
          : isLocked
          ? "border-[var(--primary)] shadow-[0_0_12px_rgba(96,96,96,0.15)]"
          : "border-[var(--border)]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[var(--primary)] !w-2.5 !h-2.5 !border-2 !border-[var(--card)]"
      />

      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[var(--border)]/60">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
              isContested
                ? "bg-[var(--destructive)]/20 text-[var(--destructive)]"
                : isLocked
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {isContested ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : isLocked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <FileCode className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-[var(--card-foreground)] font-mono truncate" title={d.path}>
              {d.path.split("/").pop()}
            </h4>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono truncate block">
              {d.path}
            </span>
          </div>
        </div>

        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
            isContested
              ? "bg-[var(--destructive)]/15 text-[var(--destructive)] border-[var(--destructive)]"
              : isLocked
              ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--border)]"
              : "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"
          }`}
        >
          {isContested ? "CONTESTED" : isLocked ? "EXCLUSIVE" : "FREE"}
        </span>
      </div>

      <div className="pt-2 space-y-1.5 text-[10px] font-mono">
        <div className="flex items-center justify-between text-[var(--muted-foreground)]">
          <span>Holder:</span>
          <span className="text-[var(--card-foreground)] font-semibold">
            {d.holder ? d.holder : "None (Unlocked)"}
          </span>
        </div>

        {isLocked && (
          <div className="flex items-center justify-between text-[var(--primary)]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>TTL Lease:</span>
            </span>
            <span className="font-bold">{d.secondsLeft}s remaining</span>
          </div>
        )}

        {isContested && (
          <div className="flex items-center justify-between text-[var(--destructive)]">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Queued Mutex:</span>
            </span>
            <span className="font-bold">Wait for unlock</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[var(--muted-foreground)] pt-0.5 border-t border-[var(--border)]/40">
          <span>AST Inbound Readers:</span>
          <span className="text-[var(--card-foreground)]">{d.readersCount} agents</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Main Component ------------------------------- */

interface SwarmLockGraphProps {
  projectId?: string;
  projectName?: string;
}

export function SwarmLockGraph({ projectId, projectName }: SwarmLockGraphProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Nodes setup
  const initialNodes: Node[] = useMemo(
    () => [
      // 1. HUMAN OPERATORS (Column 1 - Left)
      {
        id: "human-saumya",
        type: "human",
        position: { x: 40, y: 80 },
        data: {
          login: "saumya",
          name: "Saumya (Lead)",
          role: "System Architect",
          online: true,
          agentsCount: 2,
        },
      },
      {
        id: "human-alex",
        type: "human",
        position: { x: 40, y: 320 },
        data: {
          login: "alex_sec",
          name: "Alex Vance",
          role: "Security Audit",
          online: true,
          agentsCount: 2,
        },
      },

      // 2. AI AGENTS (Column 2 - Center-Left)
      {
        id: "agent-cursor",
        type: "agent",
        position: { x: 340, y: 40 },
        data: {
          label: "Cursor IDE",
          model: "claude-3-7-sonnet",
          status: "hold",
          task: "Writing session auth token engine",
          img: "/agents/cursor.png",
        },
      },
      {
        id: "agent-claude",
        type: "agent",
        position: { x: 340, y: 190 },
        data: {
          label: "Claude Code",
          model: "claude-3-7-sonnet",
          status: "clash",
          task: "Waiting for token_engine.ts mutex release",
          img: "/agents/claude.png",
        },
      },
      {
        id: "agent-copilot",
        type: "agent",
        position: { x: 340, y: 340 },
        data: {
          label: "Copilot CLI",
          model: "gpt-4o-copilot",
          status: "hold",
          task: "Refactoring Postgres vector lock table",
          img: "/agents/copilot.png",
        },
      },
      {
        id: "agent-codex",
        type: "agent",
        position: { x: 340, y: 490 },
        data: {
          label: "Codex CLI",
          model: "codex-inline-v2",
          status: "read",
          task: "Static AST read & test synthesis",
          img: "/agents/codex.png",
        },
      },

      // 3. TARGET CODE FILES & LOCK LEASES (Column 3 - Right)
      {
        id: "file-auth-token",
        type: "file",
        position: { x: 680, y: 80 },
        data: {
          path: "src/auth/token_engine.ts",
          holder: "Cursor IDE",
          status: "contested",
          secondsLeft: 18,
          readersCount: 2,
        },
      },
      {
        id: "file-lock-table",
        type: "file",
        position: { x: 680, y: 280 },
        data: {
          path: "src/engine/lock_table.rs",
          holder: "Copilot CLI",
          status: "locked",
          secondsLeft: 27,
          readersCount: 1,
        },
      },
      {
        id: "file-db-client",
        type: "file",
        position: { x: 680, y: 460 },
        data: {
          path: "src/db/client.ts",
          holder: null,
          status: "free",
          secondsLeft: 0,
          readersCount: 3,
        },
      },
    ],
    []
  );

  // Edges setup
  const initialEdges: Edge[] = useMemo(
    () => [
      // Human -> Agent delegations
      {
        id: "edge-saumya-cursor",
        source: "human-saumya",
        target: "agent-cursor",
        animated: true,
        style: { stroke: "var(--primary)", strokeWidth: 1.75 },
      },
      {
        id: "edge-saumya-claude",
        source: "human-saumya",
        target: "agent-claude",
        animated: true,
        style: { stroke: "var(--border)", strokeWidth: 1.5 },
      },
      {
        id: "edge-alex-copilot",
        source: "human-alex",
        target: "agent-copilot",
        animated: true,
        style: { stroke: "var(--primary)", strokeWidth: 1.75 },
      },
      {
        id: "edge-alex-codex",
        source: "human-alex",
        target: "agent-codex",
        animated: true,
        style: { stroke: "var(--border)", strokeWidth: 1.5 },
      },

      // Agent -> File Mutex Leases
      {
        id: "edge-cursor-token",
        source: "agent-cursor",
        target: "file-auth-token",
        animated: true,
        label: "EXCLUSIVE HOLD",
        labelStyle: { fill: "var(--foreground)", fontSize: 9, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95, stroke: "var(--border)" },
        style: { stroke: "var(--primary)", strokeWidth: 2.25 },
      },
      {
        id: "edge-claude-token-clash",
        source: "agent-claude",
        target: "file-auth-token",
        animated: true,
        label: "MUTEX QUEUED",
        labelStyle: { fill: "var(--destructive)", fontSize: 9, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95, stroke: "var(--destructive)" },
        style: { stroke: "var(--destructive)", strokeWidth: 2, strokeDasharray: "4 4" },
      },
      {
        id: "edge-copilot-locktable",
        source: "agent-copilot",
        target: "file-lock-table",
        animated: true,
        label: "EXCLUSIVE HOLD",
        labelStyle: { fill: "var(--foreground)", fontSize: 9, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95, stroke: "var(--border)" },
        style: { stroke: "var(--primary)", strokeWidth: 2.25 },
      },
      {
        id: "edge-codex-db",
        source: "agent-codex",
        target: "file-db-client",
        animated: false,
        label: "AST READ",
        labelStyle: { fill: "var(--muted-foreground)", fontSize: 9, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95, stroke: "var(--border)" },
        style: { stroke: "var(--border)", strokeWidth: 1.5, strokeDasharray: "2 2" },
      },
    ],
    []
  );

  const nodeTypes = useMemo(
    () => ({
      human: HumanNode,
      agent: AgentNode,
      file: FileNode,
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
              Human Operators
            </span>
            <span className="text-lg font-bold text-foreground">2 Online</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center text-accent-foreground">
            <User className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-[var(--radius)] bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              AI Coders Active
            </span>
            <span className="text-lg font-bold text-foreground">4 Swarm</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center text-accent-foreground">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-[var(--radius)] bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              File Locks Held
            </span>
            <span className="text-lg font-bold text-foreground">
              3 Locked / 1 Queued
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center text-accent-foreground">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-[var(--radius)] bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Collision Rate
            </span>
            <span className="text-lg font-bold text-primary">0.00% Zero</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center text-accent-foreground">
            <Shield className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Graph Canvas Container with Scoped Canvas Theme */}
      <div className="graph-canvas-theme relative w-full h-[650px] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden shadow-sm">
        {/* Graph Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-[var(--card)]/90 backdrop-blur-md px-3.5 py-2 rounded-[var(--radius)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted-foreground)]">
          <span className="text-[var(--card-foreground)] font-semibold">Topology:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            Exclusive Hold
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--destructive)]" />
            Contested / Queued
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--secondary-foreground)]" />
            AST Inspection
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
              if (node.type === "human") return "var(--accent-foreground)";
              if (node.type === "agent") return "var(--primary)";
              return "var(--destructive)";
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
                Node Inspector
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
              <span className="text-[var(--muted-foreground)] block text-[10px]">TYPE & ID</span>
              <span className="text-[var(--card-foreground)] font-semibold">
                {selectedNode.type?.toUpperCase()} · {selectedNode.id}
              </span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block text-[10px]">PAYLOAD</span>
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
