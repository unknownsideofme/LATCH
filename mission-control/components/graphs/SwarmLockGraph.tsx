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
import Image from "next/image";
import {
  Lock,
  Clock,
  Shield,
  AlertTriangle,
  User,
  Bot,
  FileCode,
  Sparkles,
  CheckCircle2,
  X,
  Activity,
} from "lucide-react";
import { useLatch } from "@/lib/LatchContext";
import { useLockGraph, type LockGraph, type GUser, type GAgent, type GFile, type GEdge } from "../lockgraph/useLockGraph";

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
    <div className="w-56 p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] text-[var(--card-foreground,#302925)] hover:border-[var(--primary,#7A3438)] transition-all shadow-sm select-none">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border,#DDD3C9)]/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[var(--sunken,#EAE3DA)] border border-[var(--border,#DDD3C9)] flex items-center justify-center text-[var(--primary,#7A3438)] font-bold text-xs">
            {(d.name || d.login || "OP").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--card-foreground,#302925)] flex items-center gap-1.5 font-sans">
              <span>{d.name || d.login}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  d.online ? "bg-[var(--green,#34734B)] animate-pulse" : "bg-[var(--muted,#776F67)]"
                }`}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--muted,#776F67)]">@{d.login}</span>
          </div>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--sunken,#EAE3DA)] text-[var(--text,#302925)] border border-[var(--border,#DDD3C9)]">
          {d.agentsCount} agent{d.agentsCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-[var(--muted,#776F67)]">
        <span>Role:</span>
        <span className="text-[var(--card-foreground,#302925)] font-semibold">{d.role || "Operator"}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[var(--primary,#7A3438)] !w-2.5 !h-2.5 !border-2 !border-[var(--card,#FFFCF8)]"
      />
    </div>
  );
}

// 2. AI Agent Node
function AgentNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    model: string;
    status: "hold" | "clash" | "wait" | "read" | "idle";
    task: string;
    img: string;
  };

  const statusConfig = {
    hold: { text: "Editing lease", color: "text-[var(--green,#34734B)]", bg: "bg-[var(--green-dim,#E8F4EC)]", border: "border-[var(--green,#34734B)]" },
    clash: { text: "Contested", color: "text-[var(--red,#B53F3F)]", bg: "bg-[var(--red-dim,#FBEBED)]", border: "border-[var(--red,#B53F3F)]" },
    wait: { text: "Queued waiter", color: "text-[var(--yellow,#91601E)]", bg: "bg-[var(--yellow-dim,#FAF1E0)]", border: "border-[var(--yellow,#91601E)]" },
    read: { text: "Reading AST", color: "text-[var(--blue,#2E6592)]", bg: "bg-[var(--blue-dim,#EAF1F7)]", border: "border-[var(--blue,#2E6592)]" },
    idle: { text: "Standby", color: "text-[var(--muted,#776F67)]", bg: "bg-[var(--sunken,#EAE3DA)]", border: "border-[var(--border,#DDD3C9)]" },
  }[d.status] || { text: "Standby", color: "text-[var(--muted,#776F67)]", bg: "bg-[var(--sunken,#EAE3DA)]", border: "border-[var(--border,#DDD3C9)]" };

  return (
    <div className="w-60 p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] text-[var(--card-foreground,#302925)] hover:border-[var(--primary,#7A3438)] transition-all shadow-sm select-none relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[var(--muted,#776F67)] !w-2.5 !h-2.5 !border-2 !border-[var(--card,#FFFCF8)]"
      />
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border,#DDD3C9)]/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--elev,#FFFFFF)] border border-[var(--border,#DDD3C9)] p-1 flex items-center justify-center shrink-0">
            {d.img ? (
              <Image
                src={d.img}
                alt={d.label}
                width={20}
                height={20}
                className="object-contain"
              />
            ) : (
              <Bot className="w-4 h-4 text-[var(--primary,#7A3438)]" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[var(--card-foreground,#302925)] font-sans">{d.label}</h4>
            <span className="text-[10px] font-mono text-[var(--muted,#776F67)]">{d.model}</span>
          </div>
        </div>
        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
        >
          {statusConfig.text}
        </span>
      </div>

      <div className="pt-2 text-[11px] font-mono text-[var(--muted,#776F67)] truncate" title={d.task}>
        &gt; {d.task}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[var(--primary,#7A3438)] !w-2.5 !h-2.5 !border-2 !border-[var(--card,#FFFCF8)]"
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
    annotation?: string;
  };

  const isLocked = d.status === "locked";
  const isContested = d.status === "contested";

  return (
    <div
      className={`w-64 p-3.5 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border text-[var(--card-foreground,#302925)] transition-all shadow-sm select-none ${
        isContested
          ? "border-[var(--red,#B53F3F)] shadow-[0_0_12px_rgba(181,63,63,0.25)]"
          : isLocked
          ? "border-[var(--primary,#7A3438)] shadow-[0_0_12px_rgba(122,52,56,0.18)]"
          : "border-[var(--border,#DDD3C9)]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[var(--primary,#7A3438)] !w-2.5 !h-2.5 !border-2 !border-[var(--card,#FFFCF8)]"
      />

      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[var(--border,#DDD3C9)]/60">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
              isContested
                ? "bg-[var(--red-dim,#FBEBED)] text-[var(--red,#B53F3F)]"
                : isLocked
                ? "bg-[var(--accent-hover,#64292D)] text-[var(--accent-ink,#FFFFFF)]"
                : "bg-[var(--sunken,#EAE3DA)] text-[var(--muted,#776F67)]"
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
            <h4 className="text-xs font-semibold text-[var(--card-foreground,#302925)] font-mono truncate" title={d.path}>
              {d.path.split("/").pop()}
            </h4>
            <span className="text-[10px] text-[var(--muted,#776F67)] font-mono truncate block">
              {d.path}
            </span>
          </div>
        </div>

        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
            isContested
              ? "bg-[var(--red-dim,#FBEBED)] text-[var(--red,#B53F3F)] border-[var(--red,#B53F3F)]"
              : isLocked
              ? "bg-[var(--primary,#7A3438)] text-[var(--primary-foreground,#FFFFFF)] border-[var(--primary,#7A3438)]"
              : "bg-[var(--sunken,#EAE3DA)] text-[var(--card-foreground,#302925)] border-[var(--border,#DDD3C9)]"
          }`}
        >
          {isContested ? "CONTESTED" : isLocked ? "EXCLUSIVE" : "FREE"}
        </span>
      </div>

      <div className="pt-2 space-y-1.5 text-[10px] font-mono">
        <div className="flex items-center justify-between text-[var(--muted,#776F67)]">
          <span>Holder:</span>
          <span className="text-[var(--card-foreground,#302925)] font-semibold truncate max-w-[130px]">
            {d.holder ? d.holder : "None (Unlocked)"}
          </span>
        </div>

        {isLocked && (
          <div className="flex items-center justify-between text-[var(--primary,#7A3438)] font-semibold">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>TTL Lease:</span>
            </span>
            <span className="font-bold">{d.secondsLeft}s remaining</span>
          </div>
        )}

        {isContested && (
          <div className="flex items-center justify-between text-[var(--red,#B53F3F)]">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Queued Mutex:</span>
            </span>
            <span className="font-bold">Wait for unlock</span>
          </div>
        )}

        {d.annotation && (
          <div className="text-[9.5px] text-[var(--muted,#776F67)] italic truncate pt-1 border-t border-[var(--border,#DDD3C9)]/40" title={d.annotation}>
            &ldquo;{d.annotation}&rdquo;
          </div>
        )}

        <div className="flex items-center justify-between text-[var(--muted,#776F67)] pt-0.5 border-t border-[var(--border,#DDD3C9)]/40">
          <span>Inbound Readers:</span>
          <span className="text-[var(--card-foreground,#302925)]">{d.readersCount} agent{d.readersCount === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Main Component ------------------------------- */

function getAgentLogo(label: string): string {
  const norm = label.toLowerCase();
  if (norm.includes("cursor")) return "/agents/cursor.png";
  if (norm.includes("claude")) return "/agents/claude.png";
  if (norm.includes("copilot")) return "/agents/copilot.png";
  if (norm.includes("codex")) return "/agents/codex.png";
  if (norm.includes("antigravity")) return "/agents/antigravity.png";
  return "/agents/cursor.png";
}

export function SwarmLockGraph() {
  const { dashboard, user } = useLatch();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const lockGraph = useLockGraph(dashboard, user, now);

  // Build live nodes from LatchContext
  const { nodes, edges } = useMemo(() => {
    const rawUsers = lockGraph.users || [];
    const rawFiles = lockGraph.files || [];
    const rawEdges = lockGraph.edges || [];

    // If completely empty (e.g. brand new workspace with no active locks yet),
    // supply active presence so the graph studio displays live operators & standby agents
    const effectiveUsers = rawUsers.length > 0 ? rawUsers : [
      {
        key: user?.login || "local",
        login: user?.login || "local",
        name: user?.name || "Local Operator",
        avatarUrl: user?.avatarUrl || null,
        online: true,
        agents: [
          {
            id: "agent_antigravity",
            label: "Antigravity",
            host: "localhost",
            userKey: user?.login || "local",
            state: "idle" as const,
          },
          {
            id: "agent_cursor",
            label: "Cursor",
            host: "localhost",
            userKey: user?.login || "local",
            state: "idle" as const,
          },
        ],
      },
    ];

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // Column 1: Human Operators
    effectiveUsers.forEach((u, uIdx) => {
      generatedNodes.push({
        id: `user-${u.key}`,
        type: "human",
        position: { x: 40, y: 60 + uIdx * 200 },
        data: {
          login: u.login,
          name: u.name,
          role: u.login === user?.login ? "Active Session" : "Room Collaborator",
          online: u.online,
          agentsCount: u.agents.length,
        },
      });

      // Column 2: Connected AI Agents
      u.agents.forEach((ag, agIdx) => {
        const agNodeId = `agent-${ag.id}`;
        generatedNodes.push({
          id: agNodeId,
          type: "agent",
          position: { x: 330, y: 40 + agIdx * 140 },
          data: {
            label: ag.label,
            model: `${ag.host || "host"}`,
            status: ag.state,
            task: ag.state === "hold" ? "Holding write lease" : ag.state === "clash" ? "Contested on lock" : "Listening on coordinator bus",
            img: getAgentLogo(ag.label),
          },
        });

        // Human -> Agent delegation edge
        generatedEdges.push({
          id: `edge-${u.key}-${ag.id}`,
          source: `user-${u.key}`,
          target: agNodeId,
          animated: ag.state !== "idle",
          style: {
            stroke: ag.state === "idle" ? "var(--border,#DDD3C9)" : "var(--primary,#7A3438)",
            strokeWidth: ag.state === "idle" ? 1.5 : 2,
          },
        });
      });
    });

    // Column 3: Target Files & Leases
    if (rawFiles.length > 0) {
      rawFiles.forEach((file, fIdx) => {
        const fileNodeId = `file-${file.id}`;
        const isContested = Boolean(file.waiting > 0 || file.clashUsers?.length);
        const isLocked = Boolean(file.holder);

        generatedNodes.push({
          id: fileNodeId,
          type: "file",
          position: { x: 670, y: 50 + fIdx * 170 },
          data: {
            path: file.path,
            holder: file.holder,
            status: isContested ? "contested" : isLocked ? "locked" : "free",
            secondsLeft: file.secondsLeft,
            readersCount: file.reader ? 1 : 0,
            annotation: file.annotation || undefined,
          },
        });
      });
    }

    // Connect Agent -> File edges
    rawEdges.forEach((e) => {
      const isClash = e.kind === "clash" || e.kind === "wait";
      const isHold = e.kind === "hold";

      generatedEdges.push({
        id: `edge-${e.id}`,
        source: `agent-${e.agentId}`,
        target: `file-${e.fileId}`,
        animated: isHold || isClash,
        label: isHold ? "EXCLUSIVE HOLD" : isClash ? "MUTEX QUEUED" : "AST READ",
        labelStyle: {
          fill: isClash ? "var(--red,#B53F3F)" : "var(--card-foreground,#302925)",
          fontSize: 9,
          fontFamily: "var(--mono)",
        },
        labelBgStyle: {
          fill: "var(--card,#FFFCF8)",
          fillOpacity: 0.95,
          stroke: isClash ? "var(--red,#B53F3F)" : "var(--border,#DDD3C9)",
        },
        style: {
          stroke: isClash ? "var(--red,#B53F3F)" : isHold ? "var(--primary,#7A3438)" : "var(--border,#DDD3C9)",
          strokeWidth: isHold ? 2.25 : 1.75,
          strokeDasharray: isClash ? "4 4" : undefined,
        },
      });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [lockGraph, user]);

  const nodeTypes = useMemo(
    () => ({
      human: HumanNode,
      agent: AgentNode,
      file: FileNode,
    }),
    []
  );

  const activeLocksCount = dashboard?.locks?.length || 0;
  const activeAgentsCount = dashboard?.agents?.length || 0;
  const collisions = dashboard?.stats?.collisions;
  const savedCount = collisions?.totalSaved || 0;

  return (
    <div className="w-full space-y-4">
      {/* Top Telemetry & Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-[var(--muted,#776F67)] uppercase tracking-wider block">
              Human Operators
            </span>
            <span className="text-lg font-bold text-[var(--text,#302925)]">
              {(dashboard?.collaborators?.length || 0) + 1} Online
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--sunken,#EAE3DA)] border border-[var(--border,#DDD3C9)] flex items-center justify-center text-[var(--primary,#7A3438)]">
            <User className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-[var(--muted,#776F67)] uppercase tracking-wider block">
              AI Agents Connected
            </span>
            <span className="text-lg font-bold text-[var(--text,#302925)]">
              {activeAgentsCount > 0 ? activeAgentsCount : 2} Swarm
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--sunken,#EAE3DA)] border border-[var(--border,#DDD3C9)] flex items-center justify-center text-[var(--primary,#7A3438)]">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-[var(--muted,#776F67)] uppercase tracking-wider block">
              Active Locks
            </span>
            <span className="text-lg font-bold text-[var(--text,#302925)]">
              {activeLocksCount} Held
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--sunken,#EAE3DA)] border border-[var(--border,#DDD3C9)] flex items-center justify-center text-[var(--primary,#7A3438)]">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)] border border-[var(--border,#DDD3C9)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-[var(--muted,#776F67)] uppercase tracking-wider block">
              Collisions Saved
            </span>
            <span className="text-lg font-bold text-[var(--primary,#7A3438)]">
              {savedCount} Protected
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--sunken,#EAE3DA)] border border-[var(--border,#DDD3C9)] flex items-center justify-center text-[var(--primary,#7A3438)]">
            <Shield className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Graph Canvas Container with Scoped Canvas Theme */}
      <div className="relative w-full h-[620px] rounded-[var(--radius,8px)] border border-[var(--border,#DDD3C9)] overflow-hidden shadow-sm bg-[var(--bg,#F2EEE8)]">
        {/* Graph Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-[var(--card,#FFFCF8)]/95 backdrop-blur-md px-3.5 py-2 rounded-[var(--radius,8px)] border border-[var(--border,#DDD3C9)] text-[11px] font-mono text-[var(--muted,#776F67)] shadow-sm">
          <span className="text-[var(--text,#302925)] font-semibold">Live Swarm:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--green,#34734B)]" />
            Exclusive Hold
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--red,#B53F3F)]" />
            Contested / Queued
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--blue,#2E6592)]" />
            AST Read
          </span>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
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
              if (node.type === "human") return "var(--primary,#7A3438)";
              if (node.type === "agent") return "var(--copper,#C28C62)";
              return "var(--green,#34734B)";
            }}
            maskColor="rgba(0, 0, 0, 0.15)"
            className="!bg-[var(--card,#FFFCF8)] !border-[var(--border,#DDD3C9)] !rounded-[var(--radius,8px)]"
          />
        </ReactFlow>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-10 w-80 p-4 rounded-[var(--radius,8px)] bg-[var(--card,#FFFCF8)]/95 backdrop-blur-md border border-[var(--border,#DDD3C9)] text-xs font-mono space-y-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 text-[var(--card-foreground,#302925)]">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border,#DDD3C9)]/60">
              <span className="text-[var(--primary,#7A3438)] font-bold uppercase tracking-wider text-[10px]">
                Node Inspector
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
              <span className="text-[var(--muted,#776F67)] block text-[10px]">TYPE & ID</span>
              <span className="text-[var(--card-foreground,#302925)] font-semibold">
                {selectedNode.type?.toUpperCase()} · {selectedNode.id}
              </span>
            </div>
            <div>
              <span className="text-[var(--muted,#776F67)] block text-[10px]">PAYLOAD</span>
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

