"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ThinkingOrb } from "thinking-orbs";
import {
  LayoutGrid,
  FolderGit2,
  Plus,
  LogOut,
  GitBranch,
  Bot,
  Search,
  ExternalLink,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Shield,
  Layers,
  Activity,
  Terminal,
  BookOpen,
  Settings,
  Copy,
  Check,
  ChevronDown,
  Clock,
  Lock,
  HelpCircle,
  Command,
  Loader2,
} from "lucide-react";
import type { ProjectRecord, GitHubRepo } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { api } from "@/lib/api";

/** Render authenticated user dashboard and repository selection with serverboard integration. */
export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Payment cancelled/failed banner
  const [paymentBanner, setPaymentBanner] = useState<{ type: "cancelled" | "failed"; message: string } | null>(null);

  // Detect payment status query param via window.location (avoids SSR Suspense requirement)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    if (paymentStatus === "cancelled") {
      setPaymentBanner({ type: "cancelled", message: "Payment was cancelled. No charges were made." });
      window.history.replaceState({}, "", "/dashboard");
      setTimeout(() => setPaymentBanner(null), 8000);
    } else if (paymentStatus === "failed") {
      setPaymentBanner({ type: "failed", message: "Payment failed. Please try again or contact support." });
      window.history.replaceState({}, "", "/dashboard");
      setTimeout(() => setPaymentBanner(null), 8000);
    }
  }, []);

  // Billing / Plan Tier
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [planTier, setPlanTier] = useState<"free" | "pro">("free");
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [customRepoName, setCustomRepoName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [agentCount, setAgentCount] = useState<number>(4);
  const [branchName, setBranchName] = useState("main");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadData() {
      // 1. Fetch authenticated user profile from serverboard
      try {
        const meRes = await api.auth.me();
        if (isSubscribed && meRes?.user) {
          setUser(meRes.user);
        }
      } catch (err: any) {
        if (isSubscribed) {
          router.push("/login");
          return;
        }
      }

      // 2. Fetch projects from serverboard API
      try {
        const projRes = await api.projects.list();
        if (isSubscribed && projRes?.projects) {
          setProjects(projRes.projects);
        }
      } catch (err: any) {
        console.warn("[projects] Failed to fetch projects:", err.message);
      }

      // 3. Fetch billing entitlement status
      try {
        const billing = await api.billing.getStatus();
        if (isSubscribed && billing) {
          setPlanTier(billing.planTier);
          setDaysRemaining(billing.daysRemaining ?? null);
          setIsExpired(Boolean(billing.expired));
        }
      } catch (err: any) {
        console.warn("[billing] Could not fetch billing status:", err.message);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    loadData();

    return () => {
      isSubscribed = false;
    };
  }, [router]);

  // Auto-refresh when any project is in deploying/pending state
  useEffect(() => {
    const hasDeploying = projects.some(
      (p) => p.status === "deploying" || p.status === "pending"
    );
    if (!hasDeploying) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.projects.list();
        if (res?.projects) {
          setProjects(res.projects);
        }
      } catch {}
    }, 6000);

    return () => clearInterval(interval);
  }, [projects]);

  const fetchGithubRepos = async () => {
    setReposLoading(true);
    setGithubError(null);
    try {
      const res = await api.github.listRepos();
      if (res?.repos && Array.isArray(res.repos)) {
        setRepos(res.repos);
      } else {
        setRepos([]);
      }
    } catch (err: any) {
      console.warn("[github] Could not fetch repos:", err.message);
      setGithubError(err.message || "Failed to load GitHub repositories");
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  };

  const handleOpenModal = () => {
    if (loading) return;
    if (planTier === "free" && projects.length >= 2) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setSelectedRepo(null);
    setRepoSearch("");
    setModalStep(1);
    setIsModalOpen(true);
    fetchGithubRepos();
  };

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setBranchName(repo.default_branch || "main");
    setModalStep(2);
  };

  const handleSelectCustomRepo = () => {
    if (!customRepoName.trim()) return;
    const parts = customRepoName.trim().split("/");
    const repoName = parts[parts.length - 1] || "custom-project";
    const customRepo: GitHubRepo = {
      id: Date.now(),
      name: repoName,
      full_name: customRepoName.trim(),
      owner: { login: parts[0] || "custom", avatar_url: "" },
      private: false,
      html_url: `https://github.com/${customRepoName.trim()}`,
      description: "Custom connected repository for Latch Swarm",
      language: "TypeScript",
      default_branch: "main",
      updated_at: new Date().toISOString(),
    };
    setSelectedRepo(customRepo);
    setProjectName(repoName);
    setBranchName("main");
    setModalStep(2);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setSubmitting(true);
    setCreateError(null);

    try {
      const res = await api.projects.create({
        projectName: projectName.trim(),
        repo: selectedRepo?.html_url || (customRepoName.trim() ? `https://github.com/${customRepoName.trim()}` : undefined),
        branch: branchName || "main",
        agentLimit: agentCount,
      });

      // Add the project directly to UI state with deploying status
      if (res?.project) {
        setProjects((prev) => [res.project, ...prev.filter((p) => p.id !== res.project.id)]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error("[projects] Create project failed:", err.message);
      setCreateError(err.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyEndpoint = (e: React.MouseEvent, url: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSignOut = async () => {
    await api.auth.logout();
    router.push("/login");
  };

  const displayedProjects = projects.filter((p) =>
    p.project_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (p.repo_name && p.repo_name.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  const filteredRepos = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(repoSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans antialiased transition-colors duration-200">
      {/* 1. SUPABASE-STYLE SLIM LEFT ICON RAIL (56px) */}
      <aside className="w-14 bg-sidebar border-r border-sidebar-border flex flex-col items-center justify-between py-3 shrink-0 z-40 select-none transition-colors duration-200">
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Logo */}
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

          <div className="w-8 h-[1px] bg-sidebar-border" />

          {/* Navigation icons */}
          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              className="w-10 h-10 rounded-lg flex items-center justify-center text-primary bg-sidebar-accent border border-sidebar-border transition-colors cursor-pointer"
              title="All Projects"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              onClick={() => router.push("/#features")}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
              title="Architecture & Protocol"
            >
              <Shield className="w-4 h-4" />
            </button>

            <button
              onClick={() => router.push("/#stream")}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
              title="Telemetry Stream"
            >
              <Activity className="w-4 h-4" />
            </button>

            <button
              onClick={() => router.push("/#evolution")}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
              title="Agent Swarms"
            >
              <Bot className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Rail Actions */}
        <div className="flex flex-col items-center gap-3 w-full">
          <div
            className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm"
            title="Daemon Port :3001 Online"
          />

          <button
            onClick={handleSignOut}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-sidebar-accent transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN DASHBOARD CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Supabase Studio Top Navigation Bar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 sticky top-0 z-30 transition-colors duration-200">
          <div className="flex items-center gap-3">
            {/* Org Switcher Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted-foreground hover:text-foreground transition-colors">
                {user?.email?.split("@")[0] || "personal-org"}
              </span>
              <span className="text-muted-foreground/60">/</span>
              <span className="text-foreground font-semibold flex items-center gap-1.5">
                All Projects
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Daemon Status Pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-border text-[11px] font-mono text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Daemon :3001</span>
            </div>

            <a
              href="https://github.com/unknownsideofme/LATCH"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Docs</span>
            </a>

            {/* Pro Swarm Badge or Upgrade CTA */}
            {planTier === "pro" ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/40 text-[11px] font-mono text-primary font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pro Swarm{daysRemaining !== null ? ` · ${daysRemaining}d left` : ""}</span>
              </div>
            ) : (
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/40 text-primary text-xs font-semibold font-mono transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade to Pro</span>
              </button>
            )}

            {/* New Project Button */}
            <button
              onClick={handleOpenModal}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>New project</span>
            </button>
          </div>
        </header>

        {/* Studio Content Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-6">
          {/* Expiration Alert if 30-Day Pro Pass Expired */}
          {isExpired && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono text-amber-500">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Your 30-day Pro Swarm pass has expired. Free tier is active (2 projects maximum).</span>
              </div>
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="px-3 py-1 rounded bg-amber-500 text-black font-semibold text-[11px] hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              >
                Renew Pro Pass
              </button>
            </div>
          )}

          {/* Payment Cancelled / Failed Banner */}
          {paymentBanner && (
            <div
              className={`p-3.5 rounded-lg flex items-center justify-between text-xs font-mono animate-in slide-in-from-top-2 duration-300 ${
                paymentBanner.type === "cancelled"
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-500"
                  : "bg-destructive/10 border border-destructive/30 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 shrink-0" />
                <span>{paymentBanner.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className={`px-3 py-1 rounded font-semibold text-[11px] transition-opacity cursor-pointer ${
                    paymentBanner.type === "cancelled"
                      ? "bg-amber-500 text-black hover:opacity-90"
                      : "bg-destructive text-destructive-foreground hover:opacity-90"
                  }`}
                >
                  Try Again
                </button>
                <button
                  onClick={() => setPaymentBanner(null)}
                  className="p-0.5 rounded hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Dashboard Title & Overview Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                All Projects
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Manage your active AI agent coordination rooms, lock tables, and telemetry streams.
              </p>
            </div>

            {/* Toolbar Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter projects..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-md bg-input border border-border text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-ring"
                />
              </div>

              <button
                onClick={handleOpenModal}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground border border-border text-xs font-mono transition-colors cursor-pointer shadow-sm"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-primary" />
                <span>Import Repo</span>
              </button>
            </div>
          </div>

          {/* MAIN BODY CONTENT */}
          {loading ? (
            <div className="py-24 text-center text-xs font-mono text-muted-foreground flex flex-col items-center gap-4">
              <ThinkingOrb state="searching" size={64} />
              <div className="space-y-1">
                <span className="text-sm font-medium text-foreground block">
                  Scanning Project Workspaces
                </span>
                <span className="text-xs text-muted-foreground">
                  Synchronizing daemon state & repository configurations…
                </span>
              </div>
            </div>
          ) : projects.length === 0 ? (
            /* SUPABASE STUDIO EMPTY STATE */
            <div className="space-y-8">
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center flex flex-col items-center justify-center max-w-2xl mx-auto space-y-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-muted border border-border text-primary flex items-center justify-center shadow-inner">
                  <FolderGit2 className="w-6 h-6" />
                </div>

                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-semibold text-foreground">
                    No projects found
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Create your first project to start synchronizing concurrent AI agents, orchestrating file locks, and inspecting AST blast radiuses.
                  </p>
                </div>

                <button
                  onClick={handleOpenModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold transition-all shadow-sm cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>New project</span>
                </button>
              </div>

              {/* Supabase-style Quickstart Helper Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                <div className="p-4 rounded-lg bg-card border border-border space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Terminal className="w-4 h-4 text-primary" />
                    <span>Quickstart CLI</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal font-mono">
                    npm install -g @latch/cli<br />
                    latch init && latch serve
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Bot className="w-4 h-4 text-primary" />
                    <span>Claude Code & Cursor Swarm</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Latch provisions zero-latency file mutex leases across concurrent IDEs and terminal agents.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>AST Blast Radius Bounds</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Prevent out-of-order writes and merge conflicts before git commits occur.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* SUPABASE STUDIO PROJECT CARDS GRID */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => router.push(`/dashboard/project/${proj.id}`)}
                  className="group rounded-lg bg-card border border-border hover:border-ring transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Row: Project Name & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                            {proj.project_name}
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground truncate block mt-0.5">
                          {proj.repo_name || proj.project_name}
                        </span>
                      </div>

                      {proj.status === "deploying" || proj.status === "pending" ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-500 shrink-0">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                          <span>DEPLOYING</span>
                        </div>
                      ) : proj.status === "failed" ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-mono text-red-500 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span>FAILED</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          <span>ACTIVE</span>
                        </div>
                      )}
                    </div>

                    {/* Stats & Metadata Matrix */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-3 border-t border-border">
                      <div className="p-2 rounded bg-muted/50 border border-border">
                        <span className="text-[10px] text-muted-foreground block uppercase">Swarm Size</span>
                        <span className="text-foreground font-semibold text-xs mt-0.5 block">
                          {proj.agent_limit || 4} Agents
                        </span>
                      </div>

                      <div className="p-2 rounded bg-muted/50 border border-border">
                        <span className="text-[10px] text-muted-foreground block uppercase">Branch</span>
                        <span className="text-primary font-semibold text-xs mt-0.5 block truncate">
                          {proj.branch || "main"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Supabase-style Card Footer with Daemon Endpoint & Copy Pill */}
                  <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between text-xs font-mono">
                    <button
                      onClick={(e) =>
                        handleCopyEndpoint(e, proj.render_url || "http://127.0.0.1:3001", proj.id)
                      }
                      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer group/btn"
                      title="Copy daemon endpoint"
                    >
                      {copiedId === proj.id ? (
                        <>
                          <Check className="w-3 h-3 text-primary" />
                          <span className="text-primary">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-muted-foreground group-hover/btn:text-foreground" />
                          <span className="truncate max-w-[150px]">
                            {proj.render_url || ":3001 Live"}
                          </span>
                        </>
                      )}
                    </button>

                    <span className="text-primary text-[11px] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>View Studio</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 3. SUPABASE-STYLE "CREATE A NEW PROJECT" MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {modalStep === 1
                    ? "Connect a GitHub Repository"
                    : "Configure Project & Agent Swarm"}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {modalStep === 1
                    ? "Choose a repository to orchestrate multi-agent file locks"
                    : "Set repository name and swarm concurrency limits"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* STEP 1: SELECT REPOSITORY */}
              {modalStep === 1 && (
                <div className="space-y-4">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search repositories…"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-md bg-input border border-border text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-ring"
                    />
                  </div>

                  {/* List of Repos */}
                  {reposLoading ? (
                    <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Fetching repositories from GitHub…</span>
                    </div>
                  ) : githubError ? (
                    <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5 text-xs space-y-2">
                      <p className="text-muted-foreground">
                        GitHub account is not connected or token expired. Connect your GitHub account to load your repositories.
                      </p>
                      <a
                        href={api.auth.getGithubOAuthUrl()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:opacity-90 font-medium transition-all"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Connect GitHub Account</span>
                      </a>
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      {repoSearch ? "No repositories match your search." : "No GitHub repositories found."}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {filteredRepos.map((repo) => (
                        <div
                          key={repo.id}
                          onClick={() => handleSelectRepo(repo)}
                          className="p-3 rounded-md bg-muted/40 border border-border hover:border-ring hover:bg-muted transition-all cursor-pointer flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                                {repo.full_name}
                              </span>
                              {repo.private && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                                  Private
                                </span>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {repo.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {repo.language && (
                              <span className="text-[10px] font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">
                                {repo.language}
                              </span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custom Repo Manual Entry */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <span className="text-[11px] font-mono text-muted-foreground block">
                      Or connect any custom GitHub repo:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="owner/repo-name"
                        value={customRepoName}
                        onChange={(e) => setCustomRepoName(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-md bg-input border border-border text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-ring"
                      />
                      <button
                        type="button"
                        onClick={handleSelectCustomRepo}
                        disabled={!customRepoName.trim()}
                        className="px-3 py-1.5 rounded-md bg-muted hover:bg-accent disabled:opacity-40 text-xs font-semibold text-primary border border-border cursor-pointer transition-colors"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: CONFIGURE PROJECT & NUMBER OF AGENTS */}
              {modalStep === 2 && (
                <form onSubmit={handleCreateProject} className="space-y-4">
                  {/* Selected Repo Banner */}
                  <div className="p-3 rounded-md bg-muted/40 border border-primary/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                          Selected Repo
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate block">
                          {selectedRepo?.full_name}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalStep(1)}
                      className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* Project Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-muted-foreground block">
                      Project Name
                    </label>
                    <input
                      type="text"
                      required
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Project Name"
                      className="w-full px-3 py-2 rounded-md bg-input border border-border text-xs text-foreground focus:outline-none focus:border-ring"
                    />
                  </div>

                  {/* Number of Agents */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-muted-foreground">
                        Concurrent Agents Limit ({planTier === "pro" ? "Pro: max 20" : "Free: max 7"})
                      </label>
                      <span className="text-xs font-mono font-bold text-primary">
                        {agentCount} Coders
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {(planTier === "pro" ? [4, 8, 14, 20] : [2, 4, 6, 7]).map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setAgentCount(count)}
                          className={`py-2 px-3 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                            agentCount === count
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground border border-border hover:text-foreground"
                          }`}
                        >
                          {count} Agents
                        </button>
                      ))}
                    </div>

                    <div className="p-3 rounded-md bg-muted/40 border border-border text-[11px] font-mono text-muted-foreground space-y-1">
                      <span className="text-primary font-medium block">
                        Allocated Swarm Slots:
                      </span>
                      {agentCount === 2 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                          <span>Claude Code CLI + Cursor IDE</span>
                        </div>
                      )}
                      {agentCount === 4 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                          <span>Claude Code + Cursor IDE + Copilot CLI + Codex Task Runner</span>
                        </div>
                      )}
                      {agentCount >= 6 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                          <span>Multi-Agent Swarm with parallel AST boundary mutex</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary Branch */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-muted-foreground block">
                      Primary Branch
                    </label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-2 rounded-md bg-input border border-border text-xs text-foreground focus:outline-none focus:border-ring"
                    />
                  </div>

                  {createError && (
                    <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono">
                      {createError}
                    </div>
                  )}

                  {/* Modal Footer Actions */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setModalStep(1)}
                      className="px-3.5 py-1.5 rounded-md bg-muted text-xs font-mono text-muted-foreground hover:text-foreground border border-border cursor-pointer transition-colors inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>

                    <button
                      type="submit"
                      disabled={submitting || !projectName.trim()}
                      className="flex-1 py-2 px-4 rounded-md bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm min-h-[36px]"
                    >
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <ThinkingOrb state="connecting" size={20} />
                          <span>Provisioning Workspace…</span>
                        </span>
                      ) : (
                        "Create new project"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        userId={user?.id}
        onUpgradeSuccess={async () => {
          setPlanTier("pro");
          // Re-fetch billing + user state to sync Pro limits
          try {
            const billing = await api.billing.getStatus();
            if (billing) {
              setPlanTier(billing.planTier);
              setDaysRemaining(billing.daysRemaining ?? null);
              setIsExpired(false);
            }
          } catch {}
          try {
            const meRes = await api.auth.me();
            if (meRes?.user) setUser(meRes.user);
          } catch {}
        }}
      />
    </div>
  );
}
