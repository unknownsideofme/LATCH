"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  Terminal,
  GitBranch,
  Bot,
  Activity,
  Copy,
  Check,
  Settings,
  Table as TableIcon,
  Network,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { ProjectRecord, ProjectLog, ProjectDeploy } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { MissionControlCast } from "@/components/MissionControlCast";
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

/** Render the route's live project cockpit with backend connection and simulated AST locks. */
function ProjectDashboardContent() {
  const params = useParams();
  const projectId = (params?.id as string) || "";
  const router = useRouter();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "swarm-graph" | "ast-graph" | "locks" | "logs" | "settings"
  >("swarm-graph");
  const [locks, setLocks] = useState<LiveLock[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Health, Logs, Deploys state
  const [healthLive, setHealthLive] = useState<boolean | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(false);
  const [logs, setLogs] = useState<ProjectLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [deploys, setDeploys] = useState<ProjectDeploy[]>([]);
  const [loadingDeploys, setLoadingDeploys] = useState<boolean>(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    projectName: "",
    branch: "main",
    agentLimit: 4,
  });
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [settingsMessage, setSettingsMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Delete project state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>("");
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await api.projects.get(projectId);
      setProject(res.project);
      setSettingsForm({
        projectName: res.project.project_name || "",
        branch: res.project.branch || "main",
        agentLimit: res.project.agent_limit || 4,
      });
    } catch (err) {
      console.warn("fetchProject transient poll error:", err);
      setProject((prev) => prev);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const checkHealth = useCallback(async () => {
    if (!projectId) return;
    setCheckingHealth(true);
    try {
      const res = await api.projects.getHealth(projectId);
      setHealthLive(res.live);
    } catch {
      setHealthLive(false);
    } finally {
      setCheckingHealth(false);
    }
  }, [projectId]);

  const fetchLogs = useCallback(async () => {
    if (!projectId) return;
    setLoadingLogs(true);
    try {
      const res = await api.projects.getLogs(projectId, 50);
      setLogs(res.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [projectId]);

  const fetchDeploys = useCallback(async () => {
    if (!projectId) return;
    setLoadingDeploys(true);
    try {
      const res = await api.projects.getDeploys(projectId);
      setDeploys(res.deploys || []);
    } catch {
      setDeploys([]);
    } finally {
      setLoadingDeploys(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Live coordinator locks sync
  useEffect(() => {
    if (!project) return;
    let es: EventSource | null = null;
    let pollId: any = null;

    const fetchLiveLocks = async () => {
      try {
        const coordRes = await fetch("http://127.0.0.1:3001/api/projects/" + encodeURIComponent(project.project_name) + "/dashboard").then(r => r.json()).catch(() => null);
        if (coordRes?.locks && Array.isArray(coordRes.locks)) {
          const mapped: LiveLock[] = coordRes.locks.map((l: any, i: number) => ({
            id: l.fencingToken ? "lck_" + l.fencingToken : "lck_" + (i + 1),
            file_path: l.filePath.includes("::") ? l.filePath.split("::")[1] : l.filePath,
            agent_id: l.agentId,
            agent_name: l.holder?.label || l.agentId.split(":")[0] || "AI Agent",
            acquired_at: "active now",
            expires_in_sec: Math.max(0, Math.ceil(((l.expiresAt || 0) - Date.now()) / 1000)),
            status: coordRes.locks.filter((o: any) => o.filePath === l.filePath).length > 1 ? "CONTESTED" : "ACTIVE",
          }));
          setLocks(mapped);
        } else {
          setLocks([]);
        }
      } catch {
        // Coordinator standby
      }
    };

    fetchLiveLocks();
    pollId = setInterval(fetchLiveLocks, 2500);

    try {
      es = new EventSource("http://127.0.0.1:3001/api/locks/stream?projectId=" + encodeURIComponent(project.project_name));
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (Array.isArray(data.locks)) {
            const mapped: LiveLock[] = data.locks.map((l: any, i: number) => ({
              id: l.fencingToken ? "lck_" + l.fencingToken : "lck_" + (i + 1),
              file_path: l.filePath.includes("::") ? l.filePath.split("::")[1] : l.filePath,
              agent_id: l.agentId,
              agent_name: l.holder?.label || l.agentId.split(":")[0] || "AI Agent",
              acquired_at: "active now",
              expires_in_sec: Math.max(0, Math.ceil(((l.expiresAt || 0) - Date.now()) / 1000)),
              status: data.locks.filter((o: any) => o.filePath === l.filePath).length > 1 ? "CONTESTED" : "ACTIVE",
            }));
            setLocks(mapped);
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (pollId) clearInterval(pollId);
      if (es) es.close();
    };
  }, [project?.project_name]);

  // Auto-poll project status if pending or deploying
  useEffect(() => {
    if (!project) return;
    const isDeploying =
      project.status === "pending" ||
      project.status === "deploying" ||
      project.status === "provisioning";

    if (!isDeploying) return;

    const interval = setInterval(() => {
      fetchProject();
      checkHealth();
    }, 6000);

    return () => clearInterval(interval);
  }, [project?.status, fetchProject, checkHealth]);

  // Lazy-load data when active tab changes
  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    } else if (activeTab === "overview") {
      fetchDeploys();
      checkHealth();
    }
  }, [activeTab, fetchLogs, fetchDeploys, checkHealth]);

  const handleReleaseLock = (lockId: string) => {
    setLocks((prev) => prev.filter((l) => l.id !== lockId));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await api.projects.update(projectId, {
        project_name: settingsForm.projectName.trim(),
        branch: settingsForm.branch.trim(),
        agent_limit: Number(settingsForm.agentLimit),
      });
      setProject(res.project);
      setSettingsMessage({
        type: "success",
        text: "Project settings updated successfully.",
      });
    } catch (err: any) {
      setSettingsMessage({
        type: "error",
        text: err?.message || "Failed to update project settings.",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.projects.delete(projectId);
      router.push("/dashboard");
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete project");
      setDeleting(false);
    }
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
            Connecting to Latch serverboard and calibrating lock tables
          </p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4 p-6">
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center">
            <Network className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Project Not Found</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No project found with ID{" "}
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {projectId}
              </code>
              .
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const isDeploying =
    project.status === "pending" ||
    project.status === "deploying" ||
    project.status === "provisioning";
  const isFailed = project.status === "failed";
  const isRunning = project.status === "running" || project.status === "active";

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
      {/* 1. COLLAPSIBLE LEFT NAVIGATION SIDEBAR */}
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
                  {isDeploying ? (
                    <span className="text-amber-500 font-semibold flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Deploying
                    </span>
                  ) : isFailed ? (
                    <span className="text-destructive font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      Failed
                    </span>
                  ) : (
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Online
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-semibold text-foreground truncate font-mono">
                  {project.project_name}
                </h3>
                <span className="text-[10px] font-mono text-muted-foreground block truncate">
                  {project.repo_name || "unknownsideofme/LATCH"}
                </span>
              </div>

              <div className="pt-3 pb-1 text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
                Chambers
              </div>
            </div>
          )}

          {/* Navigation Items */}
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
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRunning
                        ? "bg-primary animate-pulse"
                        : isDeploying
                        ? "bg-amber-500 animate-spin"
                        : "bg-destructive"
                    }`}
                  />
                  <span>Daemon {isRunning ? "Online" : isDeploying ? "Deploying" : "Offline"}</span>
                </span>
                <span className="text-[10px] text-primary font-semibold">
                  {isRunning ? "Active" : isDeploying ? "Provisioning" : "Halted"}
                </span>
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
                className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                  isRunning ? "bg-primary" : isDeploying ? "bg-amber-500 animate-pulse" : "bg-destructive"
                }`}
                title={`Daemon: ${project.status}`}
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
              {project.project_name}
            </span>

            {isDeploying ? (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-500 font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>DEPLOYING</span>
              </div>
            ) : isFailed ? (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-[10px] font-mono text-destructive font-semibold">
                <AlertCircle className="w-3 h-3" />
                <span>FAILED</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span>ACTIVE</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <ThemeToggle />
            <span className="hidden sm:inline">
              Daemon:{" "}
              <strong className="text-primary font-medium">
                {project.render_url ? "Render Cloud" : ":3001"}
              </strong>
            </span>
            <span className="hidden sm:inline">
              Swarm: <strong className="text-foreground font-medium">{project.agent_limit || 4} Agents</strong>
            </span>
          </div>
        </header>

        {/* Project Header Banner with Mission-Control Status Toolbar */}
        <div className="border-b border-border bg-card px-6 py-4 transition-colors duration-200">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-primary">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">
                    {project.project_name}
                  </h1>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {project.repo_name || project.project_name} · branch:{" "}
                    <strong className="text-primary">{project.branch || "main"}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Mission Control Live Chamber Status & Toolbar */}
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
                onClick={() =>
                  handleCopy(
                    project.render_url || "http://127.0.0.1:3001",
                    "endpoint"
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer shadow-2xs"
                title="Copy API Endpoint"
              >
                {copiedKey === "endpoint" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary font-semibold">Endpoint Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Copy Endpoint</span>
                  </>
                )}
              </button>

              {project.render_url && (
                <a
                  href={project.render_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Service</span>
                </a>
              )}
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

              <MissionControlCast tab="swarm-graph" project={project} />
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

              <MissionControlCast tab="ast-graph" project={project} />
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
                    Swarm Limit
                  </span>
                  <div className="mt-1 text-2xl font-bold text-foreground">
                    {project.agent_limit || 4} Agents
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Cursor, Claude, Copilot</p>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg shadow-sm">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Health Status
                  </span>
                  <div className="mt-1 text-base font-bold flex items-center gap-1.5">
                    {checkingHealth ? (
                      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    ) : healthLive ? (
                      <span className="text-primary flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Live
                      </span>
                    ) : isDeploying ? (
                      <span className="text-amber-500 flex items-center gap-1">
                        <Loader2 className="w-4 h-4 animate-spin" /> Deploying
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Standby</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Service heartbeat</p>
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

              {/* Connection Info Box */}
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
                  <span className="text-xs font-mono text-primary font-bold">
                    {project.render_id ? "Render Cloud" : "Port 3001"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded bg-muted/40 border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase">Project ID</span>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground truncate mr-2">{project.id}</span>
                      <button
                        onClick={() => handleCopy(project.id, "ref")}
                        className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="Copy ID"
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
                      <span className="text-primary truncate mr-2">
                        latch connect {project.project_name}
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(`latch connect ${project.project_name}`, "cli")
                        }
                        className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="Copy Command"
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

                {project.render_url && (
                  <div className="p-3 rounded bg-muted/40 border border-border space-y-1 text-xs font-mono">
                    <span className="text-[10px] text-muted-foreground uppercase">
                      Render Service URL
                    </span>
                    <div className="flex items-center justify-between">
                      <a
                        href={project.render_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate mr-2 flex items-center gap-1"
                      >
                        {project.render_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => handleCopy(project.render_url || "", "render_url")}
                        className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        {copiedKey === "render_url" ? (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Deployment History Box */}
              <div className="p-5 bg-card border border-border rounded-lg shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                      Deployment History
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Recent deployment triggers and provisioning status
                    </p>
                  </div>
                  <button
                    onClick={fetchDeploys}
                    disabled={loadingDeploys}
                    className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDeploys ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingDeploys ? (
                  <div className="py-6 flex justify-center text-muted-foreground font-mono text-xs gap-2 items-center">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Loading deployments…</span>
                  </div>
                ) : deploys.length > 0 ? (
                  <div className="divide-y divide-border font-mono text-xs">
                    {deploys.map((dep) => (
                      <div key={dep.id} className="py-2.5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{dep.id}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                dep.status === "live" || dep.status === "succeeded"
                                  ? "bg-primary/10 text-primary border border-primary/20"
                                  : dep.status === "build_in_progress" || dep.status === "in_progress"
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {dep.status}
                            </span>
                          </div>
                          {dep.commit && (
                            <span className="text-[10px] text-muted-foreground block">
                              Commit: {dep.commit}
                            </span>
                          )}
                        </div>
                        {dep.createdAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(dep.createdAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs font-mono text-muted-foreground">
                    {project.render_id
                      ? "No previous deployments recorded for this service."
                      : "Container is provisioning. Deployment history will appear once registered on Render."}
                  </div>
                )}
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

          {/* TAB 4: LOCKS (TABLE VIEW) */}
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
                    {locks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground font-mono">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <Lock className="w-5 h-5 text-muted-foreground/60" />
                            <span className="text-xs">No active file locks held � 5 AI swarm agents on standby</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      locks.map((lock) => (
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
                    )))}
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
                    Realtime Container & Daemon Logs
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isRunning ? "bg-primary animate-ping" : "bg-amber-500 animate-pulse"
                      }`}
                    />
                    <span>{project.render_url ? "Render Stream" : "Listening :3001"}</span>
                  </div>
                  <button
                    onClick={fetchLogs}
                    disabled={loadingLogs}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted border border-border text-xs font-mono text-foreground hover:bg-muted/80 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingLogs ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Console logs */}
              <div className="rounded-lg bg-zinc-950 text-zinc-200 border border-border p-4 font-mono text-xs space-y-2 max-h-[500px] overflow-y-auto">
                <div className="text-emerald-400 font-semibold">
                  &gt; [LATCH DAEMON] Connected to project: {project.project_name} (ID: {project.id})
                </div>
                <div className="text-zinc-400">
                  &gt; [MUTEX] AST lock table initialized with {project.agent_limit || 4} agent slots.
                </div>

                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="text-zinc-300 font-mono text-xs flex items-start gap-2">
                      {log.timestamp && (
                        <span className="text-zinc-500 text-[10px] shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                      <span className="break-all">{log.text}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 italic pt-2">
                    {isDeploying
                      ? "> Container is currently provisioning on Render. Live stream logs will begin shortly..."
                      : "> No external container logs found. Local daemon event bus active."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Settings Form Card */}
              <div className="border border-border bg-card rounded-lg p-6 space-y-5 shadow-sm">
                <div>
                  <h3 className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                    Project Settings & Agent Quotas
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Configure repository branch targets and concurrent agent mutex slots
                  </p>
                </div>

                {settingsMessage && (
                  <div
                    className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                      settingsMessage.type === "success"
                        ? "bg-primary/10 border-primary/20 text-primary"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    }`}
                  >
                    {settingsMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{settingsMessage.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl font-mono text-xs">
                  <div>
                    <label className="text-foreground block mb-1 font-semibold">
                      Project Name
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.projectName}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({ ...prev, projectName: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded bg-input border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-foreground block mb-1 font-semibold">
                      Target Git Branch
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.branch}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({ ...prev, branch: e.target.value }))
                      }
                      placeholder="e.g. main, dev"
                      className="w-full px-3 py-2 rounded bg-input border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      The branch checked out and synced across AI agent daemons.
                    </p>
                  </div>

                  <div>
                    <label className="text-foreground block mb-1 font-semibold">
                      Concurrent Agent Limit (1–7)
                    </label>
                    <select
                      value={settingsForm.agentLimit}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          agentLimit: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full px-3 py-2 rounded bg-input border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                        <option key={num} value={num}>
                          {num} Concurrent Agent{num > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Controls maximum simultaneous mutex leases across agents (Claude, Cursor, Copilot).
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-4 py-2 rounded-md bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingSettings ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <span>Save Changes</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Danger Zone Card */}
              <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-6 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-semibold text-destructive font-mono uppercase tracking-wider flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    <span>Danger Zone</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permanently delete this project and teardown its associated Render cloud service, lock tables, and workspace metadata.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmInput("");
                      setDeleteError(null);
                      setShowDeleteModal(true);
                    }}
                    className="px-4 py-2 rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Delete Project
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-foreground">Confirm Project Deletion</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This action cannot be undone. This will permanently delete the project{" "}
              <strong className="text-foreground font-mono">{project.project_name}</strong> and terminate any active cloud workers and lock tables.
            </p>

            {deleteError && (
              <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono">
                {deleteError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground block">
                Type <strong className="text-foreground">{project.project_name}</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={project.project_name}
                className="w-full px-3 py-2 rounded bg-input border border-border text-xs font-mono text-foreground focus:outline-hidden focus:ring-1 focus:ring-destructive"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-1.5 rounded-md border border-border text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmInput !== project.project_name || deleting}
                onClick={handleDeleteProject}
                className="px-4 py-1.5 rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-mono font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Delete Project</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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

