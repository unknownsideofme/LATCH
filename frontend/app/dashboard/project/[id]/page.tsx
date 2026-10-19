"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
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
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { ProjectRecord } from "@/lib/types";
import { SwarmLockGraph } from "@/components/graphs/SwarmLockGraph";
import { AstDependencyGraph } from "@/components/graphs/AstDependencyGraph";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThinkingOrb } from "thinking-orbs";

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
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
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
        // Fallback default sample project
        setProject({
          id: projectId || "proj_latch_core",
          user_id: "demo-user",
          project_name: "LATCH-Engine",
          repo_name: "unknownsideofme/LATCH",
          branch: "main",
          render_id: "srv_latch_core_01",
          render_url: "http://127.0.0.1:3001",
          status: "ready",
          agent_limit: 4,
          created_at: new Date().toISOString(),
        });
      }

      setLoading(false);
    }

    loadProject();
  }, [projectId]);

  // Handle local simulated lock release
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <ThinkingOrb state="solving" size={64} />
        <div className="text-center space-y-1">
          <p className="text-sm font-mono font-medium text-foreground">
            Initializing Cockpit & AST Graphs…
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            Calibrating collision-free AST lock tables
          </p>
        </div>
      </div>
    );
  }

  const NAV_ITEMS = [
    {
      id: "swarm-graph" as const,
      label: "AI Swarm Concurrency",
      shortLabel: "Swarm Graph",
      kicker: "Lock concurrency & collision",
      icon: Bot,
    },
    {
      id: "ast-graph" as const,
      label: "AST Dependency Tree",
      shortLabel: "AST Tree",
      kicker: "Blast radius & boundaries",
      icon: Network,
    },
    {
      id: "overview" as const,
      label: "Project Overview",
      shortLabel: "Overview",
      kicker: "Telemetry & node status",
      icon: Activity,
    },
    {
      id: "locks" as const,
      label: "File Mutex Leases",
      shortLabel: "Locks",
      kicker: "Distributed lock table",
      icon: TableIcon,
      badge: locks.length,
    },
    {
      id: "logs" as const,
      label: "Realtime Logs",
      shortLabel: "Logs",
      kicker: "Daemon event stream",
      icon: Terminal,
    },
    {
      id: "settings" as const,
      label: "Project Settings",
      shortLabel: "Settings",
      kicker: "Quotas & agent limits",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans antialiased transition-colors duration-200">
      {/* 1. COLLAPSIBLE LEFT NAVIGATION SIDEBAR (Openable / Closeable) */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-14"
        } bg-sidebar border-r border-sidebar-border flex flex-col justify-between py-3 shrink-0 z-40 select-none transition-all duration-300 ease-in-out`}
      >
        <div className="flex flex-col gap-3 w-full">
          {/* Top Brand & Toggle Header */}
          {sidebarOpen ? (
            <div className="flex items-center justify-between px-3 pb-2 border-b border-sidebar-border">
              <Link href="/" className="flex items-center gap-2.5 group min-w-0" title="Latch Systems">
                <div className="w-8 h-8 rounded-md overflow-hidden flex items-center justify-center border border-sidebar-border bg-card shadow-sm group-hover:border-primary/50 transition-colors p-0.5 shrink-0">
                  <Image
                    src="/latch-logo.png"
                    alt="Latch Systems"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-[var(--font-display)] font-bold text-sm tracking-tight text-foreground block truncate">
                    Latch
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground block truncate">
                    Mission Control
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border border-sidebar-border transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full pb-2 border-b border-sidebar-border">
              <Link
                href="/"
                className="w-8 h-8 rounded-md overflow-hidden flex items-center justify-center border border-sidebar-border bg-card hover:border-primary/50 transition-all shadow-sm p-0.5"
                title="Latch Systems"
              >
                <Image
                  src="/latch-logo.png"
                  alt="Latch Systems"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                  priority
                />
              </Link>
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border border-sidebar-border transition-colors cursor-pointer"
                title="Expand Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Expanded Project Workspace Card */}
          {sidebarOpen && (
            <div className="px-3 pt-1">
              <div className="p-2.5 rounded-lg bg-card border border-sidebar-border shadow-xs space-y-1">
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-muted-foreground uppercase">
                  <span>Workspace</span>
                  <span className="text-primary font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Online
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-foreground truncate font-mono">
                  {project?.project_name}
                </h3>
                <span className="text-[10px] font-mono text-muted-foreground block truncate">
                  {project?.repo_name || "unknownsideofme/LATCH"}
                </span>
              </div>

              <div className="pt-3 pb-1 text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
                Chambers
              </div>
            </div>
          )}

          {/* Navigation Items (Single source of truth for tabs) */}
          <nav className={`flex flex-col gap-1 w-full ${sidebarOpen ? "px-2" : "px-1.5 items-center"}`}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const IconComponent = item.icon;

              if (sidebarOpen) {
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full p-2 rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between gap-2.5 ${
                      isActive
                        ? "bg-sidebar-accent text-primary border border-sidebar-border font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`p-1 rounded ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                        <IconComponent className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-medium block truncate text-foreground">
                          {item.label}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground block truncate">
                          {item.kicker}
                        </span>
                      </div>
                    </div>
                    {item.badge !== undefined && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-primary border border-border shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer relative ${
                    isActive
                      ? "text-primary bg-sidebar-accent border border-sidebar-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  }`}
                  title={`${item.label} · ${item.kicker}`}
                >
                  <IconComponent className="w-4 h-4" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Rail / Footer Actions */}
        <div className={`w-full border-t border-sidebar-border pt-3 ${sidebarOpen ? "px-3 space-y-2" : "flex flex-col items-center gap-3"}`}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Daemon :3001</span>
                </span>
                <span className="text-[10px] text-primary font-semibold">Active</span>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full py-1.5 px-2.5 rounded-md bg-sidebar-accent border border-sidebar-border text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Projects</span>
              </button>
            </>
          ) : (
            <>
              <div
                className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm"
                title="Daemon Online: Port 3001"
              />
              <button
                onClick={() => router.push("/dashboard")}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
                title="Back to All Projects"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Top Breadcrumb Bar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 sticky top-0 z-30 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Projects</span>
            </Link>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-xs font-semibold text-foreground font-mono flex items-center gap-1.5">
              {project?.project_name}
            </span>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>ACTIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            {/* Theme Toggle */}
            <ThemeToggle />

            <span className="hidden sm:inline">
              Daemon: <strong className="text-primary font-medium">:3001</strong>
            </span>
            <span className="hidden sm:inline">
              Swarm: <strong className="text-foreground font-medium">{project?.agent_limit || 4} Agents</strong>
            </span>
          </div>
        </header>

        {/* Project Header Banner with Mission-Control Status Toolbar (Non-redundant) */}
        <div className="border-b border-border bg-card px-6 py-4 transition-colors duration-200">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-primary">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">
                    {project?.project_name}
                  </h1>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {project?.repo_name || project?.project_name} · branch:{" "}
                    <strong className="text-primary">{project?.branch || "main"}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Mission Control Live Chamber Status & Toolbar (Non-redundant) */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border">
                <span className="text-muted-foreground">Chamber:</span>
                <span className="text-foreground font-semibold flex items-center gap-1.5">
                  {activeTab === "swarm-graph" && (
                    <>
                      <Bot className="w-3.5 h-3.5 text-primary" />
                      <span>AI Swarm Concurrency</span>
                    </>
                  )}
                  {activeTab === "ast-graph" && (
                    <>
                      <Network className="w-3.5 h-3.5 text-primary" />
                      <span>AST Dependency Tree</span>
                    </>
                  )}
                  {activeTab === "overview" && (
                    <>
                      <Activity className="w-3.5 h-3.5 text-primary" />
                      <span>Project Overview</span>
                    </>
                  )}
                  {activeTab === "locks" && (
                    <>
                      <TableIcon className="w-3.5 h-3.5 text-primary" />
                      <span>File Mutex Leases</span>
                    </>
                  )}
                  {activeTab === "logs" && (
                    <>
                      <Terminal className="w-3.5 h-3.5 text-primary" />
                      <span>Realtime Logs</span>
                    </>
                  )}
                  {activeTab === "settings" && (
                    <>
                      <Settings className="w-3.5 h-3.5 text-primary" />
                      <span>Project Settings</span>
                    </>
                  )}
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-muted-foreground">
                <Lock className="w-3.5 h-3.5 text-primary" />
                <span>
                  <strong className="text-foreground">{locks.length}</strong> Mutex Leases
                </span>
              </div>

              <button
                onClick={(e) => handleCopy(project?.render_url || "http://127.0.0.1:3001", "endpoint")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer shadow-2xs"
                title="Copy API Endpoint"
              >
                {copiedKey === "endpoint" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary font-semibold">Copied :3001</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>:3001 Endpoint</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Studio Body Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
          {/* TAB 1: AI SWARM & LOCK GRAPH (REACT FLOW) */}
          {activeTab === "swarm-graph" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground font-mono flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    <span>AI Swarm & Multi-User Collaboration Topology</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Live visual bipartite graph attributing concurrent human operators and AI agents to active file locks.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary font-semibold">Sub-ms Mutex Bus Active</span>
                </div>
              </div>

              <SwarmLockGraph />
            </div>
          )}

          {/* TAB 2: AST DEPENDENCY GRAPH (REACT FLOW) */}
          {activeTab === "ast-graph" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground font-mono flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary" />
                    <span>AST Blast-Radius Dependency Graph</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tree-sitter module boundary graph showing which downstream contracts are bounded when an upstream file is locked.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-destructive font-semibold">Blast Radius Protection Active</span>
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
                <div className="p-4 bg-card border border-border rounded-lg shadow-sm">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Active File Locks
                  </span>
                  <div className="mt-1 text-2xl font-bold text-primary">
                    {locks.length}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">AST mutex leases</p>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg shadow-sm">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Connected Swarm
                  </span>
                  <div className="mt-1 text-2xl font-bold text-foreground">
                    {project?.agent_limit || 4} / {project?.agent_limit || 4}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Claude, Cursor, Copilot</p>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg shadow-sm">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    AST Collision Rate
                  </span>
                  <div className="mt-1 text-2xl font-bold text-primary">
                    0.00%
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Zero clobbered files</p>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg shadow-sm">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Sync Latency
                  </span>
                  <div className="mt-1 text-2xl font-bold text-foreground">
                    0.7 ms
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Lamport vector clock</p>
                </div>
              </div>

              {/* Supabase-style Connection Info Box */}
              <div className="p-5 bg-card border border-border rounded-lg space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                      Daemon Connection Details
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Connect your local AI agent CLI or IDE extension to this project
                    </p>
                  </div>
                  <span className="text-xs font-mono text-primary font-bold">Port 3001</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded bg-muted/40 border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase">Project Ref</span>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">{project?.id}</span>
                      <button
                        onClick={() => handleCopy(project?.id || "", "ref")}
                        className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        {copiedKey === "ref" ? (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-muted/40 border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase">
                      CLI Sync Command
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-primary truncate">
                        latch connect {project?.project_name}
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(`latch connect ${project?.project_name}`, "cli")
                        }
                        className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        {copiedKey === "cli" ? (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Leases Snapshot */}
              <div className="p-5 bg-card border border-border rounded-lg shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Current AST Mutex Leases ({locks.length})
                  </span>
                  <button
                    onClick={() => setActiveTab("locks")}
                    className="text-xs font-mono text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>View in table editor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {locks.map((lock) => (
                    <div
                      key={lock.id}
                      className="flex items-center justify-between p-2.5 rounded bg-muted/30 border border-border"
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-foreground">
                          {lock.agent_name}
                        </span>
                        <span className="text-muted-foreground">({lock.file_path})</span>
                      </div>
                      <span className="text-primary text-[11px] font-semibold">
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
            <div className="border border-border bg-card rounded-lg overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                    Lock Leases Table
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Active atomic file mutex reservations arbitrated by Latch daemon
                  </p>
                </div>
                <span className="text-xs font-mono text-primary font-bold">
                  {locks.length} active leases
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4">Lease ID</th>
                      <th className="py-2.5 px-4">File Path</th>
                      <th className="py-2.5 px-4">Agent Name</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Expires In</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {locks.map((lock) => (
                      <tr key={lock.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground">{lock.id}</td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {lock.file_path}
                        </td>
                        <td className="py-3 px-4 text-foreground">{lock.agent_name}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              lock.status === "CONTESTED"
                                ? "bg-destructive/15 text-destructive border border-destructive/30"
                                : "bg-primary/10 text-primary border border-primary/20"
                            }`}
                          >
                            {lock.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-primary font-semibold">{lock.expires_in_sec}s</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleReleaseLock(lock.id)}
                            className="px-2 py-1 rounded bg-muted hover:bg-destructive/20 hover:text-destructive border border-border text-[11px] transition-colors cursor-pointer"
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
            <div className="border border-border bg-card rounded-lg p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                    Realtime Agent Stream & Telemetry
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  Listening on :3001
                </div>
              </div>

              {/* Console logs */}
              <div className="rounded-lg bg-muted/40 border border-border p-6 font-mono text-xs space-y-2.5">
                <div className="text-primary font-semibold">
                  &gt; [LATCH DAEMON :3001] Connected to project: {project?.project_name}
                </div>
                <div className="text-muted-foreground">
                  &gt; [MUTEX] AST lock table initialized with {project?.agent_limit || 4} agent slots.
                </div>
                <div className="text-muted-foreground">
                  &gt; [HEARTBEAT] Cursor IDE heartbeat verified (pulse latency: 0.8ms).
                </div>
                <div className="text-muted-foreground">
                  &gt; [HEARTBEAT] Claude Code CLI authenticated. Lease held on src/engine/lock_table.rs.
                </div>
                <div className="p-4 rounded border border-primary/20 bg-primary/5 text-primary text-xs flex items-center gap-3 mt-4">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="font-semibold block text-foreground">Full Interactive Logs Viewer Staged</span>
                    <span className="text-muted-foreground text-[11px]">
                      Detailed agent step logs, AST diff inspector, and vector clock sync will be hooked up here in the next phase.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === "settings" && (
            <div className="border border-border bg-card rounded-lg p-6 space-y-5 shadow-sm">
              <h3 className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                Project Settings & Agent Quotas
              </h3>
              <div className="space-y-4 max-w-lg font-mono text-xs">
                <div>
                  <label className="text-muted-foreground block mb-1">Project Name</label>
                  <input
                    type="text"
                    readOnly
                    value={project?.project_name || ""}
                    className="w-full px-3 py-2 rounded bg-input border border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Concurrent Agent Limit</label>
                  <input
                    type="text"
                    readOnly
                    value={`${project?.agent_limit || 4} Concurrent LLM Coders`}
                    className="w-full px-3 py-2 rounded bg-input border border-border text-primary font-semibold"
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
          <ThinkingOrb state="solving" size={64} />
          <p className="text-xs font-mono text-muted-foreground">
            Synchronizing Project Studio…
          </p>
        </div>
      }
    >
      <ProjectDashboardContent />
    </Suspense>
  );
}
