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
    <div className="w-56 p-3 rounded-xl bg-[#17191E] border border-[#282B30] hover:border-[#3ECF8E]/50 transition-all shadow-md select-none">
      <div className="flex items-center justify-between pb-2 border-b border-[#23272B]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E] font-bold text-xs">
            {d.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-semibold text-[#EDEDED] flex items-center gap-1.5">
              <span>{d.name}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  d.online ? "bg-[#3ECF8E] animate-pulse" : "bg-[#8B949E]"
                }`}
              />
            </div>
            <span className="text-[10px] font-mono text-[#8B949E]">@{d.login}</span>
          </div>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#12161A] text-[#3ECF8E] border border-[#282B30]">
          {d.agentsCount} agents
        </span>
      </div>
      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-[#8B949E]">
        <span>Role:</span>
        <span className="text-[#EDEDED]">{d.role}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#3ECF8E] !w-2.5 !h-2.5 !border-2 !border-[#12161A]"
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
    hold: { text: "Editing lease", color: "text-[#3ECF8E]", bg: "bg-[#3ECF8E]/10", border: "border-[#3ECF8E]/30" },
    clash: { text: "Contested", color: "text-[#DA7756]", bg: "bg-[#DA7756]/10", border: "border-[#DA7756]/30" },
    read: { text: "Reading AST", color: "text-[#58A6FF]", bg: "bg-[#58A6FF]/10", border: "border-[#58A6FF]/30" },
    idle: { text: "Idle", color: "text-[#8B949E]", bg: "bg-[#161B22]", border: "border-[#282B30]" },
  }[d.status];

  return (
    <div className="w-60 p-3 rounded-xl bg-[#17191E] border border-[#282B30] hover:border-[#3ECF8E]/50 transition-all shadow-md select-none relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#8B949E] !w-2.5 !h-2.5 !border-2 !border-[#12161A]"
      />
      <div className="flex items-center justify-between pb-2 border-b border-[#23272B]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#12161A] border border-[#282B30] p-1 flex items-center justify-center shrink-0">
            <Image
              src={d.img}
              alt={d.label}
              width={20}
              height={20}
              className="object-contain"
            />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[#EDEDED]">{d.label}</h4>
            <span className="text-[10px] font-mono text-[#8B949E]">{d.model}</span>
          </div>
        </div>
        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
        >
          {statusConfig.text}
        </span>
      </div>

      <div className="pt-2 text-[11px] font-mono text-[#8B949E] truncate" title={d.task}>
        &gt; {d.task}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#3ECF8E] !w-2.5 !h-2.5 !border-2 !border-[#12161A]"
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
      className={`w-64 p-3.5 rounded-xl bg-[#17191E] border transition-all shadow-md select-none ${
        isContested
          ? "border-[#DA7756] shadow-[0_0_15px_rgba(218,119,86,0.15)]"
          : isLocked
          ? "border-[#3ECF8E]/60 shadow-[0_0_15px_rgba(62,207,142,0.1)]"
          : "border-[#282B30]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#3ECF8E] !w-2.5 !h-2.5 !border-2 !border-[#12161A]"
      />

      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#23272B]">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
              isContested
                ? "bg-[#DA7756]/20 text-[#DA7756]"
                : isLocked
                ? "bg-[#3ECF8E]/20 text-[#3ECF8E]"
                : "bg-[#12161A] text-[#8B949E]"
            }`}
          >
            {isContested ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <span
              className="text-xs font-semibold text-[#EDEDED] font-mono truncate block"
              title={d.path}
            >
              {d.path.split("/").pop()}
            </span>
            <span className="text-[10px] text-[#8B949E] font-mono truncate block">
              {d.path}
            </span>
          </div>
        </div>

        {isContested ? (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#DA7756]/20 text-[#DA7756] border border-[#DA7756]/40 shrink-0">
            CLASH
          </span>
        ) : isLocked ? (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40 shrink-0">
            LOCKED
          </span>
        ) : (
          <span className="text-[9px] font-mono text-[#8B949E] shrink-0">IDLE</span>
        )}
      </div>

      <div className="pt-2 flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#8B949E]">
          {d.holder ? `Held by: ${d.holder}` : "Available"}
        </span>
        {isLocked && (
          <span className="text-[#3ECF8E] flex items-center gap-1 font-semibold">
            <Clock className="w-3 h-3" />
            {d.secondsLeft}s
          </span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  human: HumanNode,
  agent: AgentNode,
  file: FileNode,
};

/* ------------------------------- Main SwarmLockGraph ------------------------------- */

export function SwarmLockGraph() {
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  // Initial Graph Topology with Humans, AI Agents, and Files
  const initialNodes: Node[] = useMemo(
    () => [
      // COLUMN 1: Humans (x: 50)
      {
        id: "human-1",
        type: "human",
        position: { x: 50, y: 70 },
        data: {
          login: "saumya",
          name: "Saumya",
          role: "Lead Architect",
          online: true,
          agentsCount: 2,
        },
      },
      {
        id: "human-2",
        type: "human",
        position: { x: 50, y: 270 },
        data: {
          login: "alex_sec",
          name: "Alex Vance",
          role: "Security Engineer",
          online: true,
          agentsCount: 2,
        },
      },

      // COLUMN 2: AI Agents (x: 400)
      {
        id: "agent-claude",
        type: "agent",
        position: { x: 400, y: 30 },
        data: {
          label: "Claude Code",
          model: "Claude 3.7 Sonnet CLI",
          status: "hold",
          task: "Refactoring auth token validation & crypto keys",
          img: "/agents/claude.png",
        },
      },
      {
        id: "agent-cursor",
        type: "agent",
        position: { x: 400, y: 150 },
        data: {
          label: "Cursor IDE",
          model: "Agent Workspace v0.46",
          status: "hold",
          task: "Optimizing sub-ms mutex table in lock_table.rs",
          img: "/agents/cursor.png",
        },
      },
      {
        id: "agent-copilot",
        type: "agent",
        position: { x: 400, y: 270 },
        data: {
          label: "Copilot CLI",
          model: "GPT-4o Workspace Runner",
          status: "clash",
          task: "Modifying route middleware exports",
          img: "/agents/copilot.png",
        },
      },
      {
        id: "agent-codex",
        type: "agent",
        position: { x: 400, y: 390 },
        data: {
          label: "Codex CLI",
          model: "Background Daemon Agent",
          status: "read",
          task: "Analyzing AST blast radius on parser.rs",
          img: "/agents/codex.png",
        },
      },

      // COLUMN 3: Locked Files & Leases (x: 770)
      {
        id: "file-auth",
        type: "file",
        position: { x: 770, y: 40 },
        data: {
          path: "src/auth/token_engine.ts",
          holder: "Claude Code",
          status: "locked",
          secondsLeft: 18,
          readersCount: 1,
        },
      },
      {
        id: "file-locktable",
        type: "file",
        position: { x: 770, y: 160 },
        data: {
          path: "src/engine/lock_table.rs",
          holder: "Cursor IDE",
          status: "locked",
          secondsLeft: 12,
          readersCount: 2,
        },
      },
      {
        id: "file-middleware",
        type: "file",
        position: { x: 770, y: 280 },
        data: {
          path: "src/api/middleware.ts",
          holder: "Copilot CLI",
          status: "contested",
          secondsLeft: 5,
          readersCount: 3,
        },
      },
      {
        id: "file-parser",
        type: "file",
        position: { x: 770, y: 400 },
        data: {
          path: "crates/ast/src/parser.rs",
          holder: "Codex CLI",
          status: "locked",
          secondsLeft: 24,
          readersCount: 0,
        },
      },
    ],
    []
  );

  // Connecting Edges with Beziers & Glow animations
  const initialEdges: Edge[] = useMemo(
    () => [
      // Human 1 (Saumya) -> Claude & Cursor
      {
        id: "e-h1-claude",
        source: "human-1",
        target: "agent-claude",
        animated: true,
        style: { stroke: "#3ECF8E", strokeWidth: 2 },
      },
      {
        id: "e-h1-cursor",
        source: "human-1",
        target: "agent-cursor",
        animated: true,
        style: { stroke: "#3ECF8E", strokeWidth: 2 },
      },

      // Human 2 (Alex) -> Copilot & Codex
      {
        id: "e-h2-copilot",
        source: "human-2",
        target: "agent-copilot",
        animated: true,
        style: { stroke: "#DA7756", strokeWidth: 2 },
      },
      {
        id: "e-h2-codex",
        source: "human-2",
        target: "agent-codex",
        animated: true,
        style: { stroke: "#58A6FF", strokeWidth: 1.8 },
      },

      // Agent -> Files
      {
        id: "e-claude-auth",
        source: "agent-claude",
        target: "file-auth",
        animated: true,
        style: { stroke: "#3ECF8E", strokeWidth: 2.2 },
      },
      {
        id: "e-cursor-locktable",
        source: "agent-cursor",
        target: "file-locktable",
        animated: true,
        style: { stroke: "#3ECF8E", strokeWidth: 2.2 },
      },
      {
        id: "e-copilot-middleware",
        source: "agent-copilot",
        target: "file-middleware",
        animated: true,
        style: { stroke: "#DA7756", strokeWidth: 2.5 },
      },
      {
        id: "e-codex-parser",
        source: "agent-codex",
        target: "file-parser",
        animated: true,
        style: { stroke: "#58A6FF", strokeWidth: 1.8 },
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Top Telemetry Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-[#17191E] border border-[#282B30] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
              Active Humans
            </span>
            <span className="text-xl font-bold text-[#EDEDED] font-[var(--font-display)]">
              2 Operators
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E]">
            <User className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#17191E] border border-[#282B30] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
              AI Agent Swarm
            </span>
            <span className="text-xl font-bold text-[#3ECF8E] font-[var(--font-display)]">
              4 Coders
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E]">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#17191E] border border-[#282B30] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
              Active File Leases
            </span>
            <span className="text-xl font-bold text-[#EDEDED] font-[var(--font-display)]">
              3 Locked · 1 Contested
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E]">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#17191E] border border-[#282B30] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
              Arbitration Status
            </span>
            <span className="text-xl font-bold text-[#3ECF8E] font-[var(--font-display)]">
              0.00% Conflicts
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E]">
            <Shield className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Interactive React Flow Canvas */}
      <div className="h-[560px] w-full rounded-xl bg-[#0F1115] border border-[#282B30] overflow-hidden relative shadow-inner">
        {/* Graph Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-[#17191E]/90 backdrop-blur-md px-3.5 py-2 rounded-lg border border-[#282B30] text-[11px] font-mono text-[#8B949E]">
          <span className="text-[#EDEDED] font-semibold">Topology:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3ECF8E]" />
            Exclusive Hold
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#DA7756]" />
            Contested / Queued
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#58A6FF]" />
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
          className="bg-[#0F1115]"
        >
          <Background color="#23272B" gap={24} size={1.2} />
          <Controls
            className="!bg-[#17191E] !border-[#282B30] !rounded-lg !overflow-hidden [&>button]:!bg-[#17191E] [&>button]:!border-b-[#282B30] [&>button]:!fill-[#EDEDED] [&>button:hover]:!bg-[#1C2024]"
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "human") return "#EDEDED";
              if (node.type === "agent") return "#3ECF8E";
              return "#DA7756";
            }}
            maskColor="rgba(15, 17, 21, 0.75)"
            className="!bg-[#17191E] !border-[#282B30] !rounded-lg"
          />
        </ReactFlow>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-10 w-80 p-4 rounded-xl bg-[#17191E]/95 backdrop-blur-md border border-[#3ECF8E]/40 text-xs font-mono space-y-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#23272B]">
              <span className="text-[#3ECF8E] font-bold uppercase tracking-wider text-[10px]">
                Node Inspector
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[#8B949E] hover:text-[#EDEDED] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div>
              <span className="text-[#8B949E] block text-[10px]">TYPE & ID</span>
              <span className="text-[#EDEDED] font-semibold">
                {selectedNode.type?.toUpperCase()} · {selectedNode.id}
              </span>
            </div>
            <div>
              <span className="text-[#8B949E] block text-[10px]">PAYLOAD</span>
              <pre className="text-[10px] text-[#3ECF8E] overflow-x-auto bg-[#12161A] p-2 rounded border border-[#23272B]">
                {JSON.stringify(selectedNode.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
