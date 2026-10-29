"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
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
  X,
  Radio,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { useLatch } from "@/lib/LatchContext";

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
    <div className="w-64 p-3.5 rounded-xl bg-[#18181b] border border-[#27272a] hover:border-[#ffe0c2]/50 text-white shadow-xl transition-all select-none">
      <div className="flex items-center justify-between pb-2.5 border-b border-[#27272a]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#27272a] border border-[#3f3f46] flex items-center justify-center text-[#ffe0c2] font-bold text-xs">
            {(d.name || d.login || "OP").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-semibold text-white flex items-center gap-1.5 font-sans">
              <span>{d.name || d.login}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  d.online ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-neutral-600"
                }`}
              />
            </div>
            <span className="text-[10.5px] font-mono text-[#a1a1aa]">@{d.login}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#222222] text-[#ffe0c2] border border-[#333333]">
          {d.agentsCount} active
        </span>
      </div>

      <div className="pt-2 flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#a1a1aa]">Session:</span>
        <span className="text-[#ffe0c2] font-semibold">{d.role || "Operator"}</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#ffe0c2] !w-3 !h-3 !border-2 !border-[#18181b]"
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
    hold: {
      text: "Holding Write Lease",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
      dot: "bg-emerald-400 animate-pulse",
    },
    clash: {
      text: "Contested Lock",
      badge: "bg-red-500/15 text-red-400 border-red-500/40 animate-pulse",
      dot: "bg-red-400 animate-ping",
    },
    wait: {
      text: "Queued Waiter",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/40",
      dot: "bg-amber-400",
    },
    read: {
      text: "Reading AST Node",
      badge: "bg-sky-500/15 text-sky-400 border-sky-500/40",
      dot: "bg-sky-400 animate-pulse",
    },
    idle: {
      text: "Connected / Standby",
      badge: "bg-neutral-800 text-neutral-300 border-neutral-700",
      dot: "bg-emerald-500",
    },
  }[d.status] || {
    text: "Standby",
    badge: "bg-neutral-800 text-neutral-400 border-neutral-700",
    dot: "bg-neutral-500",
  };

  return (
    <div className="w-64 p-3.5 rounded-xl bg-[#18181b] border border-[#27272a] hover:border-[#ffe0c2]/50 text-white shadow-xl transition-all select-none relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#a1a1aa] !w-3 !h-3 !border-2 !border-[#18181b]"
      />

      <div className="flex items-center justify-between pb-2.5 border-b border-[#27272a]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#27272a] border border-[#3f3f46] p-1.5 flex items-center justify-center shrink-0">
            {d.img ? (
              <Image
                src={d.img}
                alt={d.label}
                width={20}
                height={20}
                className="object-contain"
              />
            ) : (
              <Bot className="w-4 h-4 text-[#ffe0c2]" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white font-sans truncate">{d.label}</h4>
            <span className="text-[10px] font-mono text-[#a1a1aa] truncate block">
              {d.model}
            </span>
          </div>
        </div>

        <span className={`text-[9.5px] font-mono px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${statusConfig.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
          <span>{d.status.toUpperCase()}</span>
        </span>
      </div>

      <div className="pt-2 text-[10.5px] font-mono text-[#a1a1aa] flex items-center justify-between">
        <span className="truncate">{statusConfig.text}</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#ffe0c2] !w-3 !h-3 !border-2 !border-[#18181b]"
      />
    </div>
  );
}

// 3. Target File / Lease Node
function FileNode({ data }: NodeProps) {
  const d = data as {
    path: string;
    holder: string | null;
    status: "locked" | "contested" | "reading" | "free";
    secondsLeft: number;
    readersCount: number;
    annotation?: string;
  };

  const isLocked = d.status === "locked";
  const isContested = d.status === "contested";
  const isReading = d.status === "reading";

  return (
    <div
      className={`w-72 p-3.5 rounded-xl bg-[#18181b] border transition-all shadow-xl select-none text-white ${
        isContested
          ? "border-red-500/60 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
          : isLocked
          ? "border-amber-500/60 shadow-[0_0_16px_rgba(245,158,11,0.2)]"
          : isReading
          ? "border-sky-500/60 shadow-[0_0_16px_rgba(56,189,248,0.2)]"
          : "border-[#27272a] hover:border-[#ffe0c2]/40"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#ffe0c2] !w-3 !h-3 !border-2 !border-[#18181b]"
      />

      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#27272a]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isContested
                ? "bg-red-500/15 text-red-400"
                : isLocked
                ? "bg-amber-500/15 text-amber-400"
                : isReading
                ? "bg-sky-500/15 text-sky-400"
                : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {isContested ? (
              <AlertTriangle className="w-4 h-4" />
            ) : isLocked ? (
              <Lock className="w-4 h-4" />
            ) : isReading ? (
              <Eye className="w-4 h-4" />
            ) : (
              <FileCode className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white font-mono truncate" title={d.path}>
              {d.path.split("/").pop()}
            </h4>
            <span className="text-[10px] text-[#a1a1aa] font-mono truncate block" title={d.path}>
              {d.path}
            </span>
          </div>
        </div>

        <span
          className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
            isContested
              ? "bg-red-500/15 text-red-400 border-red-500/40 animate-pulse"
              : isLocked
              ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
              : isReading
              ? "bg-sky-500/15 text-sky-400 border-sky-500/40"
              : "bg-neutral-800 text-neutral-400 border-neutral-700"
          }`}
        >
          {isContested ? "CONTESTED" : isLocked ? "EXCLUSIVE" : isReading ? "READING" : "AVAILABLE"}
        </span>
      </div>

      <div className="pt-2.5 space-y-1.5 text-[11px] font-mono">
        <div className="flex items-center justify-between text-[#a1a1aa]">
          <span>Holder:</span>
          <span className="text-white font-semibold truncate max-w-[150px]">
            {d.holder ? d.holder : "None (Unlocked)"}
          </span>
        </div>

        {isLocked && (
          <div className="flex items-center justify-between text-amber-400 font-semibold">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>TTL Lease:</span>
            </span>
            <span className="font-bold">{d.secondsLeft}s remaining</span>
          </div>
        )}

        {isContested && (
          <div className="flex items-center justify-between text-red-400 font-semibold">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Mutex Conflict:</span>
            </span>
            <span className="font-bold">Wait for unlock</span>
          </div>
        )}

        {d.annotation && (
          <div className="text-[10px] text-[#ffe0c2] italic truncate pt-1 border-t border-[#27272a]" title={d.annotation}>
            &ldquo;{d.annotation}&rdquo;
          </div>
        )}

        <div className="flex items-center justify-between text-[#a1a1aa] pt-1 border-t border-[#27272a]">
          <span>AST Readers:</span>
          <span className="text-white">{d.readersCount} agent{d.readersCount === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Helper Functions ------------------------------- */

function normalizeAgent(rawId: string, rawLabel?: string | null): { label: string; logo: string } {
  const norm = (rawLabel || rawId || '').toLowerCase();
  if (norm.includes('claude')) return { label: 'Claude Code', logo: '/agents/claude.png' };
  if (norm.includes('cursor')) return { label: 'Cursor', logo: '/agents/cursor.png' };
  if (norm.includes('codex') || norm.includes('openai')) return { label: 'Codex', logo: '/agents/codex.png' };
  if (norm.includes('copilot') || norm.includes('github')) return { label: 'Copilot', logo: '/agents/copilot.png' };
  if (norm.includes('antigravity') || norm.includes('gemini') || norm.includes('mcp')) {
    return { label: 'Antigravity', logo: '/agents/antigravity.png' };
  }
  return { label: rawLabel || rawId || 'AI Agent', logo: '/agents/antigravity.png' };
}

function getAgentLogo(label: string): string {
  const norm = label.toLowerCase();
  if (norm.includes("cursor")) return "/agents/cursor.png";
  if (norm.includes("claude")) return "/agents/claude.png";
  if (norm.includes("copilot")) return "/agents/copilot.png";
  if (norm.includes("codex")) return "/agents/codex.png";
  if (norm.includes("antigravity")) return "/agents/antigravity.png";
  return "/agents/antigravity.png";
}

/* ------------------------------- Main Component ------------------------------- */

export function SwarmLockGraph() {
  const { dashboard, user, users } = useLatch();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Filter locks and reads strictly for current project workspace
  const projectPath = (dashboard?.project?.path || "").toLowerCase().replace(/\\/g, "/");
  const projectId = dashboard?.project?.id || "";

  const belongsToThisProject = (item: { workspaceId?: string | null }): boolean => {
    if (!item?.workspaceId) return true;
    const ws = item.workspaceId.toLowerCase().replace(/\\/g, "/");
    if (ws === projectId || ws === projectPath || (projectPath && (ws.startsWith(projectPath + "/") || ws === projectPath))) {
      return true;
    }
    if (ws.includes("appdata/local/programs") || ws.includes("program files") || ws.includes("antigravity") || ws.includes("mcp")) {
      return true;
    }
    return true;
  };

  const rawLocks = (dashboard?.locks || []).filter((l) => belongsToThisProject(l));
  const rawReads = (dashboard?.reads || []).filter((r) => belongsToThisProject(r));
  const rawAgents = dashboard?.agents || [];

  // Active connected agents - strictly from REAL locks, reads, or live connected sessions
  const activeAgents = useMemo(() => {
    const map = new Map<string, { id: string; label: string; model: string; status: "hold" | "clash" | "wait" | "read" | "idle" }>();

    // 1. From real active locks
    rawLocks.forEach((l) => {
      const isContested = rawLocks.filter((other) => other.filePath === l.filePath).length > 1;
      const label = l.holder?.label || l.agentId.split(":")[0] || "Agent";
      map.set(label.toLowerCase(), {
        id: `agent-${label.toLowerCase()}`,
        label,
        model: l.source || "coordinator",
        status: isContested ? "clash" : "hold",
      });
    });

    // 2. From real active reads
    rawReads.forEach((r) => {
      const label = r.holder?.label || r.agentId.split(":")[0] || "Agent";
      if (!map.has(label.toLowerCase())) {
        map.set(label.toLowerCase(), {
          id: `agent-${label.toLowerCase()}`,
          label,
          model: "read-ast",
          status: "read",
        });
      }
    });

    // 3. From dashboard.agents (strictly connected agents)
    rawAgents.filter((a) => a.status === "connected").forEach((a) => {
      if (!map.has(a.label.toLowerCase())) {
        map.set(a.label.toLowerCase(), {
          id: `agent-${a.label.toLowerCase()}`,
          label: a.label,
          model: a.sessionId ? `Session ${a.sessionId}` : "Connected Hook",
          status: "idle",
        });
      }
    });

    return Array.from(map.values());
  }, [rawLocks, rawReads, rawAgents]);

  const hasActiveLocksOrReads = rawLocks.length > 0 || rawReads.length > 0;

  // Build Nodes & Edges strictly when there is real active activity
  const { nodes, edges, activeLockCount, collisionCount } = useMemo(() => {
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    const activeLockCount = rawLocks.filter((l) => !l.released && (l.expiresAt ? l.expiresAt > now : true)).length;
    const collisionCount = dashboard?.stats?.collisions?.totalSaved || 0;

    // --- Column 1: Human Operator ---
    const operatorLogin = user?.login || "dev";
    const operatorName = user?.name || "Dev Operator";
    const humanNodeId = `user-${operatorLogin}`;

    generatedNodes.push({
      id: humanNodeId,
      type: "human",
      position: { x: 40, y: 120 },
      data: {
        login: operatorLogin,
        name: operatorName,
        role: "Active Workspace Lead",
        online: true,
        agentsCount: activeAgents.length,
      },
    });

    // --- Column 2: Connected AI Agents holding or reading files ---
    activeAgents.forEach((ag, idx) => {
      generatedNodes.push({
        id: ag.id,
        type: "agent",
        position: { x: 360, y: 40 + idx * 160 },
        data: {
          label: ag.label,
          model: ag.model,
          status: ag.status,
          img: getAgentLogo(ag.label),
        },
      });

      // Human -> Agent edge
      generatedEdges.push({
        id: `edge-${humanNodeId}-${ag.id}`,
        source: humanNodeId,
        target: ag.id,
        animated: ag.status !== "idle",
        style: {
          stroke: ag.status === "hold" ? "#22c55e" : ag.status === "clash" ? "#ef4444" : "#ffe0c2",
          strokeWidth: 2,
        },
      });
    });

    // --- Column 3: Strictly Real Claimed/Read Files ---
    const fileEntries: Array<{
      path: string;
      holder: string | null;
      status: "locked" | "contested" | "reading" | "free";
      secondsLeft: number;
      readersCount: number;
      annotation?: string;
      associatedAgentId?: string;
    }> = [];

    rawLocks.forEach((lock) => {
      const isContested = rawLocks.filter((other) => other.filePath === lock.filePath).length > 1;
      const cleanPath = lock.filePath.includes("::") ? lock.filePath.split("::")[1] : lock.filePath;
      const leftSec = Math.max(0, Math.ceil(((lock.expiresAt || 0) - now) / 1000));
      const holderLabel = lock.holder?.label || lock.agentId.split(":")[0] || "Agent";
      const agentNodeId = `agent-${holderLabel.toLowerCase()}`;

      fileEntries.push({
        path: cleanPath,
        holder: holderLabel,
        status: isContested ? "contested" : "locked",
        secondsLeft: leftSec,
        readersCount: rawReads.filter((r) => r.filePath === lock.filePath).length,
        annotation: lock.annotation || undefined,
        associatedAgentId: agentNodeId,
      });
    });

    rawReads.forEach((r) => {
      const cleanPath = r.filePath.includes("::") ? r.filePath.split("::")[1] : r.filePath;
      if (!fileEntries.find((f) => f.path === cleanPath)) {
        const readerLabel = r.holder?.label || r.agentId.split(":")[0] || "Agent";
        fileEntries.push({
          path: cleanPath,
          holder: null,
          status: "reading",
          secondsLeft: 0,
          readersCount: 1,
          associatedAgentId: `agent-${readerLabel.toLowerCase()}`,
        });
      }
    });

    fileEntries.forEach((file, fIdx) => {
      const fileNodeId = `file-${file.path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      generatedNodes.push({
        id: fileNodeId,
        type: "file",
        position: { x: 700, y: 30 + fIdx * 165 },
        data: {
          path: file.path,
          holder: file.holder,
          status: file.status,
          secondsLeft: file.secondsLeft,
          readersCount: file.readersCount,
          annotation: file.annotation,
        },
      });

      // Agent -> File edge
      if (file.associatedAgentId && generatedNodes.some((n) => n.id === file.associatedAgentId)) {
        generatedEdges.push({
          id: `edge-${file.associatedAgentId}-${fileNodeId}`,
          source: file.associatedAgentId,
          target: fileNodeId,
          animated: true,
          style: {
            stroke: file.status === "contested" ? "#ef4444" : file.status === "locked" ? "#22c55e" : "#38bdf8",
            strokeWidth: 2.5,
          },
        });
      }
    });

    return {
      nodes: generatedNodes,
      edges: generatedEdges,
      activeLockCount,
      collisionCount,
    };
  }, [user, activeAgents, rawLocks, rawReads, hasActiveLocksOrReads, now, dashboard?.stats?.collisions]);

  const nodeTypes = useMemo(
    () => ({
      human: HumanNode,
      agent: AgentNode,
      file: FileNode,
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
              Human Operators
            </span>
            <span className="text-2xl font-bold text-white tracking-tight">
              {users.length > 0 ? users.length : 1} Online
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#18181b] border border-[#27272a] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider block">
              AI Agents Connected
            </span>
            <span className="text-2xl font-bold text-[#ffe0c2] tracking-tight">
              {activeAgents.length} Swarm
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#ffe0c2]/10 border border-[#ffe0c2]/20 flex items-center justify-center text-[#ffe0c2]">
            <Bot className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#18181b] border border-[#27272a] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider block">
              Active Locks
            </span>
            <span className="text-2xl font-bold text-amber-400 tracking-tight">
              {activeLockCount} Held
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#18181b] border border-[#27272a] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider block">
              Collisions Saved
            </span>
            <span className="text-2xl font-bold text-sky-400 tracking-tight">
              {collisionCount} Protected
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Graph Canvas Container */}
      <div className="relative w-full h-[650px] rounded-xl border border-[#27272a] overflow-hidden shadow-2xl bg-[#111111]">
        {/* Graph Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-3 bg-[#18181b]/95 backdrop-blur-md px-3.5 py-2 rounded-lg border border-[#27272a] text-xs font-mono text-[#a1a1aa] shadow-xl">
          <span className="text-white font-semibold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Live Swarm:</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            <span className="text-neutral-200">Exclusive Hold</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]" />
            <span className="text-neutral-200">Contested / Queued</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
            <span className="text-neutral-200">AST Read</span>
          </span>
        </div>

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
                if (node.type === "human") return "#ffe0c2";
                if (node.type === "agent") return "#22c55e";
                return "#38bdf8";
              }}
              maskColor="rgba(0, 0, 0, 0.7)"
              className="!bg-[#18181b] !border-[#27272a] !rounded-lg"
            />
          </ReactFlow>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-10 w-80 p-4 rounded-xl bg-[#18181b]/95 backdrop-blur-md border border-[#27272a] text-xs font-mono space-y-2 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <span className="text-[#ffe0c2] font-bold uppercase tracking-wider text-[10.5px]">
                Node Inspector
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
              <span className="text-[#a1a1aa] block text-[10px] uppercase">Node Identifier</span>
              <span className="text-white font-semibold">
                {selectedNode.type?.toUpperCase()} &bull; {selectedNode.id}
              </span>
            </div>
            <div>
              <span className="text-[#a1a1aa] block text-[10px] uppercase">Telemetry Payload</span>
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
