"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  LayoutGrid,
  Lock,
  Clock,
  Terminal,
  Shield,
  GitBranch,
  Bot,
  Activity,
  Layers,
  Sparkles,
  Copy,
  Check,
  Settings,
  Table as TableIcon,
  LogOut,
  ChevronDown,
  BookOpen,
  Network,
  Users,
} from "lucide-react";
import type { ProjectRecord } from "@/lib/types";
import { SwarmLockGraph } from "@/components/graphs/SwarmLockGraph";
import { AstDependencyGraph } from "@/components/graphs/AstDependencyGraph";

interface LiveLock {
  id: string;
  file_path: string;
  agent_id: string;
  agent_name: string;
  acquired_at: string;
  expires_in_sec: number;
  status: "ACTIVE" | "CONTESTED" | "HEARTBEAT";
}

const defaultLocks: LiveLock[] = [
  {
    id: "lck_1",
    file_path: "src/engine/lock_table.rs",
    agent_id: "agent_cursor_01",
    agent_name: "Cursor IDE",
    acquired_at: "Just now",
    expires_in_sec: 14,
    status: "ACTIVE",
  },
  {
    id: "lck_2",
    file_path: "crates/ast/src/parser.rs",
    agent_id: "agent_claude_02",
    agent_name: "Claude Code",
    acquired_at: "24s ago",
    expires_in_sec: 6,
    status: "CONTESTED",
  },
  {
    id: "lck_3",
    file_path: "frontend/app/dashboard/page.tsx",
    agent_id: "agent_antigravity",
    agent_name: "Antigravity",
    acquired_at: "45s ago",
    expires_in_sec: 25,
    status: "HEARTBEAT",
  },
  {
    id: "lck_4",
    file_path: "tests/concurrency_test.py",
    agent_id: "agent_codex_09",
    agent_name: "Codex CLI",
    acquired_at: "1m ago",
    expires_in_sec: 19,
    status: "ACTIVE",
  },
];

function ProjectDashboardContent() {
  const params = useParams();
  const projectId = (params?.id as string) || "";
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "swarm-graph" | "ast-graph" | "locks" | "logs" | "settings"
  >("swarm-graph");
  const [locks, setLocks] = useState<LiveLock[]>(defaultLocks);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      setLoading(true);

      // Check localStorage first
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("latch_local_projects");
          if (stored) {
            const list: ProjectRecord[] = JSON.parse(stored);
            const found = list.find((p) => p.id === projectId);
            if (found) {
              setProject(found);
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore error
        }
      }

      // Query Supabase
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (data) {
        setProject(data);
      } else {
        setProject({
          id: projectId,
          user_id: "current",
          project_name: "Project " + projectId.slice(0, 8),
          status: "active",
          agent_limit: 4,
          created_at: new Date().toISOString(),
          repo_name: "repo/" + projectId.slice(0, 8),
          branch: "main",
        });
      }

      setLoading(false);
    }

    loadProject();

    // Lock timer countdown simulation
    const interval = setInterval(() => {
      setLocks((prev) =>
        prev.map((l) => ({
          ...l,
          expires_in_sec: l.expires_in_sec > 1 ? l.expires_in_sec - 1 : 30,
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [projectId]);

  const handleReleaseLock = (lockId: string) => {
    setLocks((prev) => prev.filter((l) => l.id !== lockId));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#12161A] text-[#3ECF8E] font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#3ECF8E] border-t-transparent rounded-full animate-spin" />
          <span>Opening Project Studio…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#12161A] text-[#EDEDED] font-sans antialiased">
      {/* 1. SUPABASE-STYLE SLIM LEFT ICON RAIL */}
      <aside className="w-14 bg-[#12161A] border-r border-[#23272B] flex flex-col items-center justify-between py-3 shrink-0 z-40 select-none">
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="w-8 h-8 rounded-md bg-[#3ECF8E] text-black font-extrabold text-sm flex items-center justify-center hover:bg-[#4EFAAE] transition-all"
            title="Back to All Projects"
          >
            L
          </Link>

          <div className="w-8 h-[1px] bg-[#23272B]" />

          {/* Navigation icons inside Project */}
          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              onClick={() => setActiveTab("swarm-graph")}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === "swarm-graph"
                  ? "text-[#3ECF8E] bg-[#1C2024] border border-[#282B30]"
                  : "text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024]"
              }`}
              title="AI Swarm & Lock Graph"
            >
              <Bot className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab("ast-graph")}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === "ast-graph"
                  ? "text-[#3ECF8E] bg-[#1C2024] border border-[#282B30]"
                  : "text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024]"
              }`}
              title="AST Dependency Graph"
            >
              <Network className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab("overview")}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === "overview"
                  ? "text-[#3ECF8E] bg-[#1C2024] border border-[#282B30]"
                  : "text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024]"
              }`}
              title="Project Overview"
            >
              <Activity className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab("locks")}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === "locks"
                  ? "text-[#3ECF8E] bg-[#1C2024] border border-[#282B30]"
                  : "text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024]"
              }`}
              title="Lock Table Editor"
            >
              <TableIcon className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === "logs"
                  ? "text-[#3ECF8E] bg-[#1C2024] border border-[#282B30]"
                  : "text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024]"
              }`}
              title="Realtime Logs"
            >
              <Terminal className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === "settings"
                  ? "text-[#3ECF8E] bg-[#1C2024] border border-[#282B30]"
                  : "text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024]"
              }`}
              title="Project Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Rail Status */}
        <div className="flex flex-col items-center gap-3 w-full">
          <div
            className="w-2.5 h-2.5 rounded-full bg-[#3ECF8E] shadow-[0_0_8px_rgba(62,207,142,0.8)]"
            title="Daemon Online"
          />
          <button
            onClick={() => router.push("/dashboard")}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024] transition-colors cursor-pointer"
            title="Back to All Projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0F1115]">
        {/* Top Breadcrumb Bar */}
        <header className="h-14 border-b border-[#23272B] bg-[#12161A] flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-mono text-[#8B949E] hover:text-[#EDEDED] transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Projects</span>
            </Link>
            <span className="text-[#484F58]">/</span>
            <span className="text-xs font-semibold text-[#EDEDED] font-mono flex items-center gap-1.5">
              {project?.project_name}
            </span>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[10px] font-mono text-[#3ECF8E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
              <span>ACTIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#8B949E]">
            <span className="hidden sm:inline">
              Daemon: <strong className="text-[#3ECF8E] font-medium">:3001</strong>
            </span>
            <span className="hidden sm:inline">
              Swarm: <strong className="text-[#EDEDED] font-medium">{project?.agent_limit || 4} Agents</strong>
            </span>
          </div>
        </header>

        {/* Project Header Banner & Sub-Tabs */}
        <div className="border-b border-[#23272B] bg-[#17191E] px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#282B30] flex items-center justify-center text-[#3ECF8E]">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-[#EDEDED]">
                    {project?.project_name}
                  </h1>
                  <span className="text-[11px] font-mono text-[#8B949E]">
                    {project?.repo_name || project?.project_name} · branch:{" "}
                    <strong className="text-[#3ECF8E]">{project?.branch || "main"}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Supabase-styled Horizontal Sub-Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-[#12161A] p-1 rounded-lg border border-[#282B30] text-xs font-mono">
              <button
                onClick={() => setActiveTab("swarm-graph")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "swarm-graph"
                    ? "bg-[#1C2024] text-[#3ECF8E] font-semibold"
                    : "text-[#8B949E] hover:text-[#EDEDED]"
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI Swarm & Lock Graph</span>
              </button>

              <button
                onClick={() => setActiveTab("ast-graph")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "ast-graph"
                    ? "bg-[#1C2024] text-[#3ECF8E] font-semibold"
                    : "text-[#8B949E] hover:text-[#EDEDED]"
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>AST Dependency Graph</span>
              </button>

              <button
                onClick={() => setActiveTab("overview")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "overview"
                    ? "bg-[#1C2024] text-[#3ECF8E] font-semibold"
                    : "text-[#8B949E] hover:text-[#EDEDED]"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab("locks")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "locks"
                    ? "bg-[#1C2024] text-[#3ECF8E] font-semibold"
                    : "text-[#8B949E] hover:text-[#EDEDED]"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>File Locks ({locks.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("logs")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "logs"
                    ? "bg-[#1C2024] text-[#3ECF8E] font-semibold"
                    : "text-[#8B949E] hover:text-[#EDEDED]"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Logs</span>
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "settings"
                    ? "bg-[#1C2024] text-[#3ECF8E] font-semibold"
                    : "text-[#8B949E] hover:text-[#EDEDED]"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Studio Body Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
          {/* TAB 1: AI SWARM & LOCK GRAPH (REACT FLOW) */}
          {activeTab === "swarm-graph" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#23272B]">
                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] font-mono flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#3ECF8E]" />
                    <span>AI Swarm & Multi-User Collaboration Topology</span>
                  </h3>
                  <p className="text-[11px] text-[#8B949E] mt-0.5">
                    Live visual bipartite graph attributing concurrent human operators and AI agents to active file locks.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
                  <span className="text-[#3ECF8E]">Sub-ms Mutex Bus Active</span>
                </div>
              </div>

              <SwarmLockGraph />
            </div>
          )}

          {/* TAB 2: AST DEPENDENCY GRAPH (REACT FLOW) */}
          {activeTab === "ast-graph" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#23272B]">
                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] font-mono flex items-center gap-2">
                    <Network className="w-4 h-4 text-[#3ECF8E]" />
                    <span>AST Blast-Radius Dependency Graph</span>
                  </h3>
                  <p className="text-[11px] text-[#8B949E] mt-0.5">
                    Tree-sitter module boundary graph showing which downstream contracts are bounded when an upstream file is locked.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#DA7756] animate-pulse" />
                  <span className="text-[#DA7756]">Blast Radius Protection Active</span>
                </div>
              </div>

              <AstDependencyGraph />
            </div>
          )}

          {/* TAB 3: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Telemetry Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 bg-[#17191E] border border-[#282B30] rounded-lg">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E]">
                    Active File Locks
                  </span>
                  <div className="mt-1 text-2xl font-bold text-[#3ECF8E]">
                    {locks.length}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#8B949E]">AST mutex leases</p>
                </div>

                <div className="p-4 bg-[#17191E] border border-[#282B30] rounded-lg">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E]">
                    Connected Swarm
                  </span>
                  <div className="mt-1 text-2xl font-bold text-[#EDEDED]">
                    {project?.agent_limit || 4} / {project?.agent_limit || 4}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#8B949E]">Claude, Cursor, Copilot</p>
                </div>

                <div className="p-4 bg-[#17191E] border border-[#282B30] rounded-lg">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E]">
                    AST Collision Rate
                  </span>
                  <div className="mt-1 text-2xl font-bold text-[#3ECF8E]">
                    0.00%
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#8B949E]">Zero clobbered files</p>
                </div>

                <div className="p-4 bg-[#17191E] border border-[#282B30] rounded-lg">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E]">
                    Sync Latency
                  </span>
                  <div className="mt-1 text-2xl font-bold text-[#EDEDED]">
                    0.7 ms
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#8B949E]">Lamport vector clock</p>
                </div>
              </div>

              {/* Supabase-style Connection Info Box */}
              <div className="p-5 bg-[#17191E] border border-[#282B30] rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#23272B]">
                  <div>
                    <h3 className="text-xs font-semibold text-[#EDEDED] font-mono uppercase tracking-wider">
                      Daemon Connection Details
                    </h3>
                    <p className="text-[11px] text-[#8B949E]">
                      Connect your local AI agent CLI or IDE extension to this project
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#3ECF8E]">Port 3001</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded bg-[#12161A] border border-[#23272B] space-y-1">
                    <span className="text-[10px] text-[#8B949E] uppercase">Project Ref</span>
                    <div className="flex items-center justify-between">
                      <span className="text-[#EDEDED]">{project?.id}</span>
                      <button
                        onClick={() => handleCopy(project?.id || "", "ref")}
                        className="text-[#8B949E] hover:text-[#3ECF8E] transition-colors cursor-pointer"
                      >
                        {copiedKey === "ref" ? (
                          <Check className="w-3.5 h-3.5 text-[#3ECF8E]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-[#12161A] border border-[#23272B] space-y-1">
                    <span className="text-[10px] text-[#8B949E] uppercase">
                      CLI Sync Command
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-[#3ECF8E] truncate">
                        latch connect {project?.project_name}
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(`latch connect ${project?.project_name}`, "cli")
                        }
                        className="text-[#8B949E] hover:text-[#3ECF8E] transition-colors cursor-pointer"
                      >
                        {copiedKey === "cli" ? (
                          <Check className="w-3.5 h-3.5 text-[#3ECF8E]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Leases Snapshot */}
              <div className="p-5 bg-[#17191E] border border-[#282B30] rounded-lg">
                <div className="flex items-center justify-between pb-3 border-b border-[#23272B] mb-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#8B949E]">
                    Current AST Mutex Leases ({locks.length})
                  </span>
                  <button
                    onClick={() => setActiveTab("locks")}
                    className="text-xs font-mono text-[#3ECF8E] hover:underline cursor-pointer"
                  >
                    View in table editor →
                  </button>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {locks.map((lock) => (
                    <div
                      key={lock.id}
                      className="flex items-center justify-between p-2.5 rounded bg-[#12161A] border border-[#23272B]"
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-[#3ECF8E]" />
                        <span className="font-semibold text-[#EDEDED]">
                          {lock.agent_name}
                        </span>
                        <span className="text-[#8B949E]">({lock.file_path})</span>
                      </div>
                      <span className="text-[#3ECF8E] text-[11px]">
                        {lock.expires_in_sec}s remaining
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LOCKS (SUPABASE TABLE VIEW) */}
          {activeTab === "locks" && (
            <div className="border border-[#282B30] bg-[#17191E] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[#23272B] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-[#EDEDED] font-mono uppercase tracking-wider">
                    Lock Leases Table
                  </h3>
                  <p className="text-[11px] text-[#8B949E]">
                    Active atomic file mutex reservations arbitrated by Latch daemon
                  </p>
                </div>
                <span className="text-xs font-mono text-[#3ECF8E]">
                  {locks.length} active leases
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#12161A] text-[#8B949E] border-b border-[#23272B]">
                    <tr>
                      <th className="py-2.5 px-4">Lease ID</th>
                      <th className="py-2.5 px-4">File Path</th>
                      <th className="py-2.5 px-4">Agent Name</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Expires In</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23272B]">
                    {locks.map((lock) => (
                      <tr key={lock.id} className="hover:bg-[#1C2024] transition-colors">
                        <td className="py-3 px-4 text-[#8B949E]">{lock.id}</td>
                        <td className="py-3 px-4 font-semibold text-[#EDEDED]">
                          {lock.file_path}
                        </td>
                        <td className="py-3 px-4 text-[#EDEDED]">{lock.agent_name}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              lock.status === "CONTESTED"
                                ? "bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/30"
                                : "bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30"
                            }`}
                          >
                            {lock.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#3ECF8E]">{lock.expires_in_sec}s</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleReleaseLock(lock.id)}
                            className="px-2 py-1 rounded bg-[#12161A] hover:bg-[#DA7756]/20 hover:text-[#DA7756] border border-[#23272B] text-[11px] transition-colors cursor-pointer"
                          >
                            Release
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: REALTIME LOGS */}
          {activeTab === "logs" && (
            <div className="border border-[#282B30] bg-[#17191E] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#23272B]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#3ECF8E]" />
                  <h3 className="text-xs font-semibold text-[#EDEDED] font-mono uppercase tracking-wider">
                    Realtime Agent Stream & Telemetry
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#8B949E]">
                  <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-ping" />
                  Listening on :3001
                </div>
              </div>

              {/* Console logs */}
              <div className="rounded-lg bg-[#12161A] border border-[#23272B] p-6 font-mono text-xs space-y-2.5">
                <div className="text-[#3ECF8E]">
                  &gt; [LATCH DAEMON :3001] Connected to project: {project?.project_name}
                </div>
                <div className="text-[#8B949E]">
                  &gt; [MUTEX] AST lock table initialized with {project?.agent_limit || 4} agent slots.
                </div>
                <div className="text-[#8B949E]">
                  &gt; [HEARTBEAT] Cursor IDE heartbeat verified (pulse latency: 0.8ms).
                </div>
                <div className="text-[#8B949E]">
                  &gt; [HEARTBEAT] Claude Code CLI authenticated. Lease held on src/engine/lock_table.rs.
                </div>
                <div className="p-4 rounded border border-[#3ECF8E]/20 bg-[#3ECF8E]/5 text-[#3ECF8E] text-xs flex items-center gap-3 mt-4">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="font-semibold block">Full Interactive Logs Viewer Staged</span>
                    <span className="text-[#8B949E] text-[11px]">
                      Detailed agent step logs, AST diff inspector, and vector clock sync will be hooked up here in the next phase.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === "settings" && (
            <div className="border border-[#282B30] bg-[#17191E] rounded-lg p-6 space-y-5">
              <h3 className="text-xs font-semibold text-[#EDEDED] font-mono uppercase tracking-wider">
                Project Settings & Agent Quotas
              </h3>
              <div className="space-y-4 max-w-lg font-mono text-xs">
                <div>
                  <label className="text-[#8B949E] block mb-1">Project Name</label>
                  <input
                    type="text"
                    readOnly
                    value={project?.project_name || ""}
                    className="w-full px-3 py-2 rounded bg-[#12161A] border border-[#282B30] text-[#EDEDED]"
                  />
                </div>
                <div>
                  <label className="text-[#8B949E] block mb-1">Concurrent Agent Limit</label>
                  <input
                    type="text"
                    readOnly
                    value={`${project?.agent_limit || 4} Concurrent LLM Coders`}
                    className="w-full px-3 py-2 rounded bg-[#12161A] border border-[#282B30] text-[#3ECF8E]"
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ProjectDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#12161A] text-[#3ECF8E] font-mono text-xs">
          Loading project studio…
        </div>
      }
    >
      <ProjectDashboardContent />
    </Suspense>
  );
}
