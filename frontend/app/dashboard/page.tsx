"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
} from "lucide-react";
import type { ProjectRecord, GitHubRepo } from "@/lib/types";

// Curated default repositories if GitHub API token is not yet connected
const defaultSampleRepos: GitHubRepo[] = [
  {
    id: 101,
    name: "LATCH",
    full_name: "unknownsideofme/LATCH",
    owner: { login: "unknownsideofme", avatar_url: "" },
    private: false,
    html_url: "https://github.com/unknownsideofme/LATCH",
    description: "Cross-agent coordination layer with sub-ms file mutex and AST graph arbitration",
    language: "TypeScript",
    default_branch: "main",
    updated_at: new Date().toISOString(),
  },
  {
    id: 102,
    name: "claude-code-runner",
    full_name: "anthropic/claude-code-runner",
    owner: { login: "anthropic", avatar_url: "" },
    private: false,
    html_url: "https://github.com/anthropic/claude-code-runner",
    description: "Terminal CLI coordinator for autonomous LLM coding loops",
    language: "Rust",
    default_branch: "main",
    updated_at: new Date().toISOString(),
  },
  {
    id: 103,
    name: "cursor-swarm-workspace",
    full_name: "getcursor/cursor-swarm-workspace",
    owner: { login: "getcursor", avatar_url: "" },
    private: true,
    html_url: "https://github.com/getcursor/cursor-swarm-workspace",
    description: "Multi-window agent synchronization and local workspace cache",
    language: "TypeScript",
    default_branch: "main",
    updated_at: new Date().toISOString(),
  },
  {
    id: 104,
    name: "ast-blast-radius",
    full_name: "latch-systems/ast-blast-radius",
    owner: { login: "latch-systems", avatar_url: "" },
    private: false,
    html_url: "https://github.com/latch-systems/ast-blast-radius",
    description: "Tree-sitter boundary analyzer preventing concurrent phantom writes",
    language: "Go",
    default_branch: "main",
    updated_at: new Date().toISOString(),
  },
  {
    id: 105,
    name: "supabase-realtime-engine",
    full_name: "supabase/realtime-engine",
    owner: { login: "supabase", avatar_url: "" },
    private: false,
    html_url: "https://github.com/supabase/realtime-engine",
    description: "Distributed Postgres change streams and vector clock synchronization",
    language: "Elixir",
    default_branch: "master",
    updated_at: new Date().toISOString(),
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Project Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1); // 1 = Select Repo, 2 = Configure Project & Agents
  const [repos, setRepos] = useState<GitHubRepo[]>(defaultSampleRepos);
  const [repoSearch, setRepoSearch] = useState<string>("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [customRepoName, setCustomRepoName] = useState<string>("");

  // Configuration Box form states
  const [projectName, setProjectName] = useState<string>("");
  const [agentCount, setAgentCount] = useState<number>(4);
  const [branchName, setBranchName] = useState<string>("main");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load user & projects on mount
  useEffect(() => {
    let isSubscribed = true;

    async function loadData() {
      setLoading(true);

      let activeUser: any = null;

      // 1. Try Supabase session
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          activeUser = session.user;
        }
      } catch {
        // ignore
      }

      // 2. Fallback to localStorage session if Supabase cookie is resolving
      if (!activeUser && typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("latch_user_session");
          if (stored) {
            activeUser = JSON.parse(stored);
          }
        } catch {
          // ignore
        }
      }

      if (!activeUser) {
        router.push("/login");
        return;
      }

      if (!isSubscribed) return;
      setUser(activeUser);
      if (typeof window !== "undefined") {
        localStorage.setItem("latch_user_session", JSON.stringify(activeUser));
      }

      // Check local storage for persisted user projects
      let combinedProjects: ProjectRecord[] = [];
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("latch_local_projects");
          if (stored) {
            combinedProjects = JSON.parse(stored);
          }
        } catch {
          // ignore
        }
      }

      // Query Supabase
      try {
        const { data: userProjects } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", activeUser.id)
          .order("created_at", { ascending: false });

        if (userProjects && userProjects.length > 0) {
          const existingIds = new Set(userProjects.map((p: ProjectRecord) => p.id));
          combinedProjects = [
            ...userProjects,
            ...combinedProjects.filter((p: ProjectRecord) => !existingIds.has(p.id)),
          ];
        }
      } catch {
        // Supabase query error fallback
      }

      setProjects(combinedProjects);
      setLoading(false);

      // Attempt to fetch real GitHub repos if authenticated with GitHub
      try {
        const ghRes = await fetch("/api/github/repos");
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          if (ghData.repos && ghData.repos.length > 0) {
            setRepos(ghData.repos);
          }
        }
      } catch {
        // keep defaultSampleRepos
      }
    }

    loadData();

    // Listen to real-time auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (session?.user) {
        setUser(session.user);
        if (typeof window !== "undefined") {
          localStorage.setItem("latch_user_session", JSON.stringify(session.user));
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("latch_user_session");
        }
        router.push("/login");
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleOpenModal = () => {
    setSelectedRepo(null);
    setRepoSearch("");
    setModalStep(1);
    setIsModalOpen(true);
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
    const custom: GitHubRepo = {
      id: Date.now(),
      name: repoName,
      full_name: customRepoName.trim(),
      owner: { login: parts[0] || "user", avatar_url: "" },
      private: false,
      html_url: `https://github.com/${customRepoName.trim()}`,
      description: "Custom connected repository",
      language: "TypeScript",
      default_branch: "main",
      updated_at: new Date().toISOString(),
    };
    handleSelectRepo(custom);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setSubmitting(true);
    const newId = crypto.randomUUID();
    const newProject: ProjectRecord = {
      id: newId,
      user_id: user?.id || "operator",
      project_name: projectName.trim(),
      repo_name: selectedRepo?.full_name || projectName.trim(),
      repo_url: selectedRepo?.html_url || "",
      branch: branchName || "main",
      language: selectedRepo?.language || "TypeScript",
      render_id: `rnd_${newId.substring(0, 8)}`,
      render_url: "http://127.0.0.1:3001",
      status: "active",
      agent_limit: Number(agentCount),
      created_at: new Date().toISOString(),
    };

    // Save to localStorage
    const updated = [newProject, ...projects];
    setProjects(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("latch_local_projects", JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    // Insert into Supabase
    try {
      await supabase.from("projects").insert({
        id: newProject.id,
        user_id: newProject.user_id,
        project_name: newProject.project_name,
        render_id: newProject.render_id,
        render_url: newProject.render_url,
        status: newProject.status,
        agent_limit: newProject.agent_limit,
      });
    } catch {
      // ignore
    }

    setSubmitting(false);
    setIsModalOpen(false);
  };

  const handleCopyEndpoint = (e: React.MouseEvent, url: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("latch_user_session");
    }
    await supabase.auth.signOut();
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
    <div className="min-h-screen flex bg-[#12161A] text-[#EDEDED] font-sans antialiased">
      {/* 1. SUPABASE-STYLE SLIM LEFT ICON RAIL (56px) */}
      <aside className="w-14 bg-[#12161A] border-r border-[#23272B] flex flex-col items-center justify-between py-3 shrink-0 z-40 select-none">
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Logo */}
          <Link
            href="/"
            className="w-8 h-8 rounded-md bg-[#3ECF8E] text-black font-extrabold text-sm flex items-center justify-center hover:bg-[#4EFAAE] transition-all shadow-[0_0_12px_rgba(62,207,142,0.3)]"
            title="Latch Systems"
          >
            L
          </Link>

          <div className="w-8 h-[1px] bg-[#23272B]" />

          {/* Navigation icons */}
          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#3ECF8E] bg-[#1C2024] border border-[#282B30] transition-colors"
              title="All Projects"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              onClick={() => router.push("/#features")}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024] transition-colors"
              title="Architecture & Protocol"
            >
              <Shield className="w-4 h-4" />
            </button>

            <button
              onClick={() => router.push("/#stream")}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024] transition-colors"
              title="Telemetry Stream"
            >
              <Activity className="w-4 h-4" />
            </button>

            <button
              onClick={() => router.push("/#evolution")}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024] transition-colors"
              title="Agent Swarms"
            >
              <Bot className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Rail Actions */}
        <div className="flex flex-col items-center gap-3 w-full">
          <div
            className="w-2.5 h-2.5 rounded-full bg-[#3ECF8E] shadow-[0_0_8px_rgba(62,207,142,0.8)]"
            title="Daemon Port :3001 Online"
          />

          <button
            onClick={handleSignOut}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#8B949E] hover:text-[#DA7756] hover:bg-[#1C2024] transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN DASHBOARD CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0F1115]">
        {/* Supabase Studio Top Navigation Bar */}
        <header className="h-14 border-b border-[#23272B] bg-[#12161A] flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Org Switcher Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#8B949E] hover:text-[#EDEDED] transition-colors">
                {user?.email?.split("@")[0] || "personal-org"}
              </span>
              <span className="text-[#484F58]">/</span>
              <span className="text-[#EDEDED] font-semibold flex items-center gap-1.5">
                All Projects
                <ChevronDown className="w-3.5 h-3.5 text-[#8B949E]" />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Daemon Status Pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#17191E] border border-[#23272B] text-[11px] font-mono text-[#8B949E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E]" />
              <span>Daemon :3001</span>
            </div>

            <a
              href="https://github.com/unknownsideofme/LATCH"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024] transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Docs</span>
            </a>

            {/* Supabase Emerald "+ New project" Button on Left/Top */}
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#3ECF8E] hover:bg-[#4EFAAE] text-black text-xs font-semibold transition-all shadow-[0_1px_3px_rgba(0,0,0,0.3)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New project</span>
            </button>
          </div>
        </header>

        {/* Studio Content Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-6">
          {/* Dashboard Title & Overview Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#EDEDED]">
                All Projects
              </h1>
              <p className="text-xs text-[#8B949E] mt-1">
                Manage your active AI agent coordination rooms, lock tables, and telemetry streams.
              </p>
            </div>

            {/* Toolbar Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-[#8B949E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter projects..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#17191E] border border-[#282B30] text-xs text-[#EDEDED] placeholder-[#6B7280] focus:outline-none focus:border-[#3ECF8E]"
                />
              </div>

              <button
                onClick={handleOpenModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#17191E] hover:bg-[#1C2024] text-[#EDEDED] border border-[#282B30] text-xs font-mono transition-colors cursor-pointer"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-[#3ECF8E]" />
                <span>Import Repo</span>
              </button>
            </div>
          </div>

          {/* MAIN BODY CONTENT */}
          {loading ? (
            <div className="py-24 text-center text-xs font-mono text-[#8B949E] flex flex-col items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#3ECF8E] border-t-transparent rounded-full animate-spin" />
              <span>Loading projects…</span>
            </div>
          ) : projects.length === 0 ? (
            /* SUPABASE STUDIO EMPTY STATE */
            <div className="space-y-8">
              <div className="rounded-xl border border-dashed border-[#282B30] bg-[#17191E] p-12 text-center flex flex-col items-center justify-center max-w-2xl mx-auto space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#12161A] border border-[#282B30] text-[#3ECF8E] flex items-center justify-center shadow-inner">
                  <FolderGit2 className="w-6 h-6" />
                </div>

                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-semibold text-[#EDEDED]">
                    No projects found
                  </h3>
                  <p className="text-xs text-[#8B949E] leading-relaxed">
                    Create your first project to start synchronizing concurrent AI agents, orchestrating file locks, and inspecting AST blast radiuses.
                  </p>
                </div>

                <button
                  onClick={handleOpenModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#3ECF8E] hover:bg-[#4EFAAE] text-black text-xs font-semibold transition-all shadow-sm cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>New project</span>
                </button>
              </div>

              {/* Supabase-style Quickstart Helper Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#23272B]">
                <div className="p-4 rounded-lg bg-[#17191E] border border-[#282B30] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#EDEDED]">
                    <Terminal className="w-4 h-4 text-[#3ECF8E]" />
                    <span>Quickstart CLI</span>
                  </div>
                  <p className="text-[11px] text-[#8B949E] leading-normal font-mono">
                    npm install -g @latch/cli<br />
                    latch init && latch serve
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#17191E] border border-[#282B30] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#EDEDED]">
                    <Bot className="w-4 h-4 text-[#3ECF8E]" />
                    <span>Claude Code & Cursor Swarm</span>
                  </div>
                  <p className="text-[11px] text-[#8B949E] leading-normal">
                    Latch provisions zero-latency file mutex leases across concurrent IDEs and terminal agents.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#17191E] border border-[#282B30] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#EDEDED]">
                    <Shield className="w-4 h-4 text-[#3ECF8E]" />
                    <span>AST Blast Radius Bounds</span>
                  </div>
                  <p className="text-[11px] text-[#8B949E] leading-normal">
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
                  className="group rounded-lg bg-[#17191E] border border-[#282B30] hover:border-[#3ECF8E]/60 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Row: Project Name & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#EDEDED] group-hover:text-[#3ECF8E] transition-colors truncate">
                            {proj.project_name}
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono text-[#8B949E] truncate block mt-0.5">
                          {proj.repo_name || proj.project_name}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[10px] font-mono text-[#3ECF8E] shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
                        <span>ACTIVE</span>
                      </div>
                    </div>

                    {/* Stats & Metadata Matrix */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-3 border-t border-[#23272B]">
                      <div className="p-2 rounded bg-[#12161A] border border-[#23272B]">
                        <span className="text-[10px] text-[#8B949E] block uppercase">Swarm Size</span>
                        <span className="text-[#EDEDED] font-semibold text-xs mt-0.5 block">
                          {proj.agent_limit || 4} Agents
                        </span>
                      </div>

                      <div className="p-2 rounded bg-[#12161A] border border-[#23272B]">
                        <span className="text-[10px] text-[#8B949E] block uppercase">Branch</span>
                        <span className="text-[#3ECF8E] font-semibold text-xs mt-0.5 block truncate">
                          {proj.branch || "main"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Supabase-style Card Footer with Daemon Endpoint & Copy Pill */}
                  <div className="px-5 py-3 bg-[#12161A] border-t border-[#23272B] flex items-center justify-between text-xs font-mono">
                    <button
                      onClick={(e) =>
                        handleCopyEndpoint(e, proj.render_url || "http://127.0.0.1:3001", proj.id)
                      }
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#8B949E] hover:text-[#EDEDED] transition-colors cursor-pointer group/btn"
                      title="Copy daemon endpoint"
                    >
                      {copiedId === proj.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#3ECF8E]" />
                          <span className="text-[#3ECF8E]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#8B949E] group-hover/btn:text-[#EDEDED]" />
                          <span className="truncate max-w-[150px]">
                            {proj.render_url || ":3001 Live"}
                          </span>
                        </>
                      )}
                    </button>

                    <span className="text-[#3ECF8E] text-[11px] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      View Studio →
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#17191E] border border-[#282B30] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#23272B] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#EDEDED]">
                  {modalStep === 1
                    ? "Connect a GitHub Repository"
                    : "Configure Project & Agent Swarm"}
                </h3>
                <p className="text-[11px] text-[#8B949E] mt-0.5">
                  {modalStep === 1
                    ? "Choose a repository to orchestrate multi-agent file locks"
                    : "Set repository name and swarm concurrency limits"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-[#8B949E] hover:text-[#EDEDED] hover:bg-[#1C2024] transition-colors cursor-pointer"
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
                    <Search className="w-3.5 h-3.5 text-[#8B949E] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search repositories…"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-md bg-[#12161A] border border-[#282B30] text-xs text-[#EDEDED] placeholder-[#6B7280] focus:outline-none focus:border-[#3ECF8E]"
                    />
                  </div>

                  {/* List of Repos */}
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {filteredRepos.map((repo) => (
                      <div
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo)}
                        className="p-3 rounded-md bg-[#12161A] border border-[#282B30] hover:border-[#3ECF8E]/50 hover:bg-[#1C2024] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#EDEDED] group-hover:text-[#3ECF8E] transition-colors truncate">
                              {repo.full_name}
                            </span>
                            {repo.private && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#17191E] text-[#8B949E] border border-[#282B30]">
                                Private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-[11px] text-[#8B949E] truncate mt-0.5">
                              {repo.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {repo.language && (
                            <span className="text-[10px] font-mono text-[#3ECF8E] px-1.5 py-0.5 rounded bg-[#3ECF8E]/10">
                              {repo.language}
                            </span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-[#8B949E] group-hover:text-[#3ECF8E] group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Custom Repo Manual Entry */}
                  <div className="pt-3 border-t border-[#23272B] space-y-2">
                    <span className="text-[11px] font-mono text-[#8B949E] block">
                      Or connect any custom GitHub repo:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="owner/repo-name"
                        value={customRepoName}
                        onChange={(e) => setCustomRepoName(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-md bg-[#12161A] border border-[#282B30] text-xs text-[#EDEDED] placeholder-[#6B7280] focus:outline-none focus:border-[#3ECF8E]"
                      />
                      <button
                        type="button"
                        onClick={handleSelectCustomRepo}
                        disabled={!customRepoName.trim()}
                        className="px-3 py-1.5 rounded-md bg-[#1C2024] hover:bg-[#282B30] disabled:opacity-40 text-xs font-semibold text-[#3ECF8E] border border-[#282B30] cursor-pointer"
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
                  <div className="p-3 rounded-md bg-[#12161A] border border-[#3ECF8E]/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-[#3ECF8E] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-[#8B949E] block uppercase">
                          Selected Repo
                        </span>
                        <span className="text-xs font-semibold text-[#EDEDED] truncate block">
                          {selectedRepo?.full_name}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalStep(1)}
                      className="text-[11px] font-mono text-[#3ECF8E] hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* Project Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[#8B949E] block">
                      Project Name
                    </label>
                    <input
                      type="text"
                      required
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Project Name"
                      className="w-full px-3 py-2 rounded-md bg-[#12161A] border border-[#282B30] text-xs text-[#EDEDED] focus:outline-none focus:border-[#3ECF8E]"
                    />
                  </div>

                  {/* Number of Agents */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-[#8B949E]">
                        Concurrent Agents Limit
                      </label>
                      <span className="text-xs font-mono font-bold text-[#3ECF8E]">
                        {agentCount} Coders
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[2, 4, 6, 8].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setAgentCount(count)}
                          className={`py-2 px-3 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                            agentCount === count
                              ? "bg-[#3ECF8E] text-black shadow-sm"
                              : "bg-[#12161A] text-[#8B949E] border border-[#282B30] hover:text-[#EDEDED]"
                          }`}
                        >
                          {count} Agents
                        </button>
                      ))}
                    </div>

                    <div className="p-3 rounded-md bg-[#12161A] border border-[#282B30] text-[11px] font-mono text-[#8B949E] space-y-1">
                      <span className="text-[#3ECF8E] font-medium block">
                        Allocated Swarm Slots:
                      </span>
                      {agentCount === 2 && (
                        <span>• Claude Code CLI + Cursor IDE</span>
                      )}
                      {agentCount === 4 && (
                        <span>• Claude Code + Cursor IDE + Copilot CLI + Codex Task Runner</span>
                      )}
                      {agentCount >= 6 && (
                        <span>• Multi-Agent Swarm with parallel AST boundary mutex</span>
                      )}
                    </div>
                  </div>

                  {/* Primary Branch */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[#8B949E] block">
                      Primary Branch
                    </label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-2 rounded-md bg-[#12161A] border border-[#282B30] text-xs text-[#EDEDED] focus:outline-none focus:border-[#3ECF8E]"
                    />
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="pt-3 border-t border-[#23272B] flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setModalStep(1)}
                      className="px-3.5 py-1.5 rounded-md bg-[#12161A] text-xs font-mono text-[#8B949E] hover:text-[#EDEDED] border border-[#282B30] cursor-pointer"
                    >
                      ← Back
                    </button>

                    <button
                      type="submit"
                      disabled={submitting || !projectName.trim()}
                      className="flex-1 py-2 px-4 rounded-md bg-[#3ECF8E] hover:bg-[#4EFAAE] text-black font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {submitting ? "Creating Project…" : "Create new project"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
