"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroRadialLight } from "@/components/landing/HeroRadialLight";
import { HalftoneWordmarkFooter } from "@/components/ui/halftone-wordmark-footer";
import { useTheme } from "next-themes";
import {
  Terminal,
  Copy,
  Check,
  Cpu,
  Users,
  Shield,
  Bot,
  Layers,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Zap,
  Activity,
  AlertTriangle,
  FolderGit2,
  Share2,
  HardDrive,
  Network,
  Radio,
  FileCode,
  Wrench,
  HelpCircle,
  ChevronRight,
  ListOrdered,
} from "lucide-react";

/** Interactive Terminal Box Snippet with macOS Traffic Light Dots & Copy-to-Clipboard */
function CodeBlock({
  code,
  language = "bash",
  title,
}: {
  code: string;
  language?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const defaultTitle =
    language === "bash" || language === "sh"
      ? "terminal — bash"
      : `file — ${language}`;

  const lines = code.trim().split("\n");

  return (
    <div className="rounded-xl border border-border/80 bg-[#0d1117] dark:bg-[#07090d] text-[#c9d1d9] shadow-xl overflow-hidden transition-all my-3 font-mono text-xs">
      {/* Terminal Window Header Bar */}
      <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.03] select-none">
        {/* Window Control Buttons */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block shadow-xs" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block shadow-xs" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block shadow-xs" />
          <span className="ml-2.5 text-[11px] text-white/50 font-mono">
            {title || defaultTitle}
          </span>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          aria-label="Copy snippet"
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all text-[11px] cursor-pointer border border-white/10"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-primary" />
              <span className="text-primary text-[10px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Terminal Body with Prompt Styling */}
      <div className="p-3.5 sm:p-4 overflow-x-auto text-[12.5px] leading-relaxed">
        {language === "bash" || language === "sh" ? (
          <div className="space-y-1">
            {lines.map((line, idx) => {
              const trimmed = line.trim();
              if (trimmed.startsWith("#")) {
                return (
                  <div key={idx} className="text-[#8b949e] italic">
                    {line}
                  </div>
                );
              }
              if (trimmed.length === 0) {
                return <div key={idx} className="h-2" />;
              }
              return (
                <div key={idx} className="flex items-baseline gap-2 text-white">
                  <span className="text-primary font-bold select-none text-[11px]">❯</span>
                  <span className="font-semibold text-emerald-300 dark:text-emerald-400">
                    {line}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <pre className="text-[#e6edf3] whitespace-pre font-mono leading-relaxed">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
}

/** Modern Interactive Terminal for CLI Installation with Package Manager Tabs */
function InstallCliTerminal() {
  const [pkgManager, setPkgManager] = useState<"npm" | "pnpm" | "yarn" | "bun">("npm");
  const [copied, setCopied] = useState(false);

  const installCommands: Record<string, string> = {
    npm: "npm i -g latch-it",
    pnpm: "pnpm add -g latch-it",
    yarn: "yarn global add latch-it",
    bun: "bun add -g latch-it",
  };

  const fullScript = `# 1. Install latch cli globally
${installCommands[pkgManager]}

# 2. Check whether it is installed
latch --version

# 3. Login using your GitHub identity
latch login`;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(fullScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 space-y-3 font-mono">
      {/* Sleek Terminal Window */}
      <div className="rounded-2xl border border-border/80 bg-[#0d1117] dark:bg-[#07090d] text-[#c9d1d9] shadow-2xl overflow-hidden transition-all">
        {/* Terminal Window Header Bar */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/[0.03] select-none flex-wrap gap-2">
          {/* Window Control Buttons */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-xs" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-xs" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-xs" />
            <span className="ml-3 text-xs text-white/50 font-mono hidden sm:inline">
              terminal — bash
            </span>
          </div>

          {/* Package Manager Tabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10 text-xs">
            {(["npm", "pnpm", "yarn", "bun"] as const).map((pm) => (
              <button
                key={pm}
                onClick={() => setPkgManager(pm)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                  pkgManager === pm
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {pm}
              </button>
            ))}
          </div>

          {/* Copy All Button */}
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all text-xs cursor-pointer border border-white/10"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary text-[11px]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">Copy All</span>
              </>
            )}
          </button>
        </div>

        {/* Terminal Body with Line Execution Display */}
        <div className="p-4 sm:p-6 text-xs sm:text-[13px] leading-relaxed space-y-4">
          {/* Line 1 */}
          <div>
            <div className="text-[#8b949e] italic">// 1. Install the latch cli globally</div>
            <div className="flex items-center justify-between group/cmd mt-1">
              <div className="flex items-center gap-2 text-white">
                <span className="text-primary font-bold select-none">❯</span>
                <span className="font-semibold text-emerald-400">{installCommands[pkgManager]}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(installCommands[pkgManager]);
                }}
                className="opacity-0 group-hover/cmd:opacity-100 transition-opacity text-[10px] text-white/50 hover:text-white px-2 py-0.5 rounded bg-white/5"
              >
                copy line
              </button>
            </div>
          </div>

          {/* Line 2 */}
          <div>
            <div className="text-[#8b949e] italic">// 2. Verify installation</div>
            <div className="flex items-center justify-between group/cmd mt-1">
              <div className="flex items-center gap-2 text-white">
                <span className="text-primary font-bold select-none">❯</span>
                <span className="font-semibold text-white">latch --version</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("latch --version");
                }}
                className="opacity-0 group-hover/cmd:opacity-100 transition-opacity text-[10px] text-white/50 hover:text-white px-2 py-0.5 rounded bg-white/5"
              >
                copy line
              </button>
            </div>
          </div>

          {/* Line 3 */}
          <div>
            <div className="text-[#8b949e] italic">// 3. Authenticate with your GitHub identity</div>
            <div className="flex items-center justify-between group/cmd mt-1">
              <div className="flex items-center gap-2 text-white">
                <span className="text-primary font-bold select-none">❯</span>
                <span className="font-semibold text-amber-300">latch login</span>
                <span className="text-[#8b949e] text-xs"># follow the prompts</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("latch login");
                }}
                className="opacity-0 group-hover/cmd:opacity-100 transition-opacity text-[10px] text-white/50 hover:text-white px-2 py-0.5 rounded bg-white/5"
              >
                copy line
              </button>
            </div>
          </div>
        </div>

        {/* Terminal Bottom Status Bar */}
        <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] text-[#8b949e]">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready for execution</span>
          </span>
          <span className="hidden sm:inline">Node.js 18+ · macOS · Linux · WSL2</span>
        </div>
      </div>
    </div>
  );
}

/** Documentation Index navigation items with index numbers */
const INDEX_ITEMS = [
  { id: "install", index: "01", label: "Installing the CLI" },
  { id: "quickstart-modes", index: "02", label: "Quickstart (3 Minutes)" },
  { id: "verification", index: "03", label: "Verify Write Locking" },
  { id: "agents", index: "04", label: "Supported Agents & Hooks" },
  { id: "cli-reference", index: "05", label: "CLI Reference" },
  { id: "mission-control", index: "06", label: "Mission Control Studio" },
  { id: "mcp", index: "07", label: "MCP Context Server" },
  { id: "config", index: "08", label: "Environment & Config" },
  { id: "troubleshooting", index: "09", label: "Troubleshooting" },
];

const STD_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export default function QuickstartPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"host" | "guest">("host");
  const [activeSection, setActiveSection] = useState<string>("install");
  const [isMobileIndexOpen, setIsMobileIndexOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track active section on scroll to highlight side menu index
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-15% 0px -65% 0px",
        threshold: 0,
      }
    );

    INDEX_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground relative transition-colors duration-200"
      style={{ fontFamily: STD_FONT }}
    >
      {/* Background Ambient Radial Glow */}
      <HeroRadialLight colorMode="green" position="center" topClass="top-[200px]" />

      {/* Fixed Header */}
      <LandingHeader />

      {/* Fixed Full-Height Left Navigation Sidebar (Desktop) */}
      <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-64 xl:w-72 2xl:w-80 border-r border-border bg-card/40 backdrop-blur-md z-30 select-none flex-col justify-between">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between text-[11px] font-mono tracking-wider text-muted-foreground uppercase shrink-0">
          <span className="flex items-center gap-2 font-bold text-foreground">
            <ListOrdered className="w-4 h-4 text-primary" /> Indexes
          </span>
          <span className="text-muted-foreground/80 font-mono text-[11px]">
            {INDEX_ITEMS.length} sections
          </span>
        </div>

        {/* Scrollable Navigation List: Clean Left-Indicator Style (No Bulky Boxes) */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {INDEX_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-150 ${
                  isActive
                    ? "text-foreground font-medium bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                {/* Active Indicator Bar on the left */}
                <span
                  className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full transition-all duration-200 ${
                    isActive
                      ? "bg-primary shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                      : "bg-transparent group-hover:bg-muted-foreground/20"
                  }`}
                />

                {/* Index Number (Clean tabular text, no inner pill box) */}
                <span
                  className={`text-[11px] font-mono tabular-nums transition-colors pl-1 ${
                    isActive
                      ? "text-primary font-bold"
                      : "text-muted-foreground/50 group-hover:text-muted-foreground"
                  }`}
                >
                  {item.index}
                </span>

                {/* Section Title */}
                <span className="truncate">{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Bottom Pinned Footer */}
        <div className="p-4 border-t border-border bg-card/30 shrink-0">
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-all group border border-border/60"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span>Launch Cockpit</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area: Offset by full-height sidebar */}
      <div className="lg:pl-64 xl:pl-72 2xl:pl-80 w-full pt-16 flex-1 flex flex-col">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-12 w-full flex-1">
          {/* Mobile Index Accordion Toggle (Small screens only) */}
          <div className="lg:hidden mb-8">
            <button
              onClick={() => setIsMobileIndexOpen(!isMobileIndexOpen)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-card border border-border shadow-xs text-xs font-mono text-foreground font-semibold"
            >
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-primary" />
                <span>
                  Indexes ({INDEX_ITEMS.find((i) => i.id === activeSection)?.index || "01"}{" "}
                  {INDEX_ITEMS.find((i) => i.id === activeSection)?.label})
                </span>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  isMobileIndexOpen ? "rotate-90" : ""
                }`}
              />
            </button>

            {isMobileIndexOpen && (
              <div className="mt-2 p-2 rounded-xl bg-card border border-border space-y-0.5 animate-in fade-in-50 font-mono text-xs">
                {INDEX_ITEMS.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setIsMobileIndexOpen(false)}
                      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "text-foreground font-medium bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full ${
                          isActive ? "bg-primary" : "bg-transparent"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-mono tabular-nums pl-1 ${
                          isActive ? "text-primary font-bold" : "text-muted-foreground/60"
                        }`}
                      >
                        {item.index}
                      </span>
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Content Stream: Open Layout (No Box Containers) */}
          <main className="space-y-16">
            {/* Top Title Banner */}
            <div className="pb-8 border-b border-border/80">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-3">
                <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
                <span>/</span>
                <span className="text-primary font-medium">Quickstart</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                Quickstart Guide
              </h1>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 1: INSTALLING THE CLI                                             */}
            {/* ========================================================================= */}
            <section id="install" className="scroll-mt-24 pb-14 border-b border-border/60">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-primary font-bold">01</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground tracking-wider uppercase">Setup</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-2">
                Installing the CLI
              </h2>

              <InstallCliTerminal />

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/30 border border-border/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Node.js 18+ required
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/30 border border-border/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  macOS · Linux · Windows (WSL2)
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/30 border border-border/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  Zero native C++ build steps
                </span>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: QUICKSTART MODES (Host vs Guest)                               */}
            {/* ========================================================================= */}
            <section id="quickstart-modes" className="scroll-mt-24 pb-14 border-b border-border/60">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                    <span className="text-primary font-bold">02</span>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="text-muted-foreground tracking-wider uppercase">Workflows</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    Quickstart: Getting Started in 3 Minutes
                  </h2>
                </div>

                {/* Mode Switcher Buttons */}
                <div className="inline-flex p-1 rounded-xl bg-muted/40 border border-border/70 shadow-xs">
                  <button
                    onClick={() => setActiveTab("host")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                      activeTab === "host"
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Mode A: Room Host</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("guest")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                      activeTab === "guest"
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Mode B: Teammate / Guest</span>
                  </button>
                </div>
              </div>

              {/* MODE A: ROOM HOST (Vertical Step Timeline) */}
              {activeTab === "host" && (
                <div className="space-y-8 animate-in fade-in-50 duration-200">
                  <div className="flex items-center gap-2 text-xs font-mono text-primary">
                    <Radio className="w-3.5 h-3.5" />
                    <span>Host Role: Arbitrates distributed locks across connected agents.</span>
                  </div>

                  {/* Vertical Timeline Track */}
                  <div className="border-l-2 border-primary/30 ml-3.5 pl-6 sm:pl-8 space-y-10 relative">
                    {/* Step 1 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        1
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                        Step 1: Sign In with GitHub
                      </h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        Locks will be attributed to your GitHub handle (e.g., <code className="text-foreground font-mono">@developer</code>) so teammates know who holds each file.
                      </p>
                      <CodeBlock code="latch login" language="bash" />
                    </div>

                    {/* Step 2 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        2
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">
                        Step 2: Register a Repository
                      </h3>
                      <p className="text-xs text-muted-foreground mb-2">If cloning a new repository:</p>
                      <CodeBlock
                        code={`latch clone https://github.com/your-org/your-repo.git
cd your-repo`}
                        language="bash"
                      />
                      <p className="text-xs text-muted-foreground mt-4 mb-2">If you already have the repository on your disk:</p>
                      <CodeBlock
                        code={`latch add /path/to/existing-repo
cd /path/to/existing-repo`}
                        language="bash"
                      />
                      <p className="text-xs text-muted-foreground italic mt-2">
                        *Registers repository and installs hooks for Claude Code, Cursor, Copilot, Codex, and Antigravity automatically.*
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        3
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">
                        Step 3: Start the Coordination Daemon
                      </h3>
                      <CodeBlock code="latch serve" language="bash" />
                      <p className="text-xs text-muted-foreground italic mt-2">
                        *Starts local API daemon on <code className="text-foreground font-mono">http://127.0.0.1:3001</code> and Mission Control on <code className="text-foreground font-mono">http://localhost:3002</code>.*
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        4
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                        Step 4: Share the Room
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        In Mission Control (<code className="text-foreground font-mono">http://localhost:3002</code>), navigate to <strong>Team → Share</strong>. Latch generates an encrypted invite link with an embedded room token to share with teammates.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE B: TEAMMATE / GUEST */}
              {activeTab === "guest" && (
                <div className="space-y-8 animate-in fade-in-50 duration-200">
                  <div className="flex items-center gap-2 text-xs font-mono text-primary">
                    <Users className="w-3.5 h-3.5" />
                    <span>Guest Role: Teammates keep their own files and run their own agents locally.</span>
                  </div>

                  {/* Vertical Timeline Track for Guests */}
                  <div className="border-l-2 border-primary/30 ml-3.5 pl-6 sm:pl-8 space-y-10 relative">
                    {/* Step 1 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        1
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                        Step 1: Authenticate Identity
                      </h3>
                      <CodeBlock code="latch login" language="bash" />
                    </div>

                    {/* Step 2 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        2
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                        Step 2: Clone the Repository Locally
                      </h3>
                      <CodeBlock
                        code={`latch clone https://github.com/your-org/your-repo.git
cd your-repo`}
                        language="bash"
                      />
                    </div>

                    {/* Step 3 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        3
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                        Step 3: Start Your Local Latch Daemon
                      </h3>
                      <CodeBlock code="latch serve" language="bash" />
                    </div>

                    {/* Step 4 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        4
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                        Step 4: Connect to the Host&apos;s Room
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        In Mission Control (<code className="text-foreground font-mono">http://localhost:3002</code>) → navigate to <strong>Team → Join</strong> → Paste host invite link.
                      </p>
                    </div>

                    {/* Step 5 */}
                    <div className="relative">
                      <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-6 h-6 rounded-full bg-background border-2 border-primary text-primary font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                        5
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                        Step 5: Pull Host&apos;s Live Uncommitted State
                      </h3>
                      <CodeBlock code="latch pull" language="bash" />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: TESTING YOUR FIRST COORDINATED WRITE                           */}
            {/* ========================================================================= */}
            <section id="verification" className="scroll-mt-24 pb-12 border-b border-border/60">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-primary font-bold">03</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground tracking-wider uppercase">Verification</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-6">
                Testing Your First Coordinated Write
              </h2>

              <ol className="space-y-5 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted text-foreground font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Open your terminal or IDE agent (e.g. <strong>Claude Code</strong>, <strong>Cursor</strong>, or <strong>Antigravity</strong>).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted text-foreground font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Prompt the agent to refactor a file (e.g. <code className="text-foreground font-mono">src/auth.ts</code>).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted text-foreground font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="w-full">
                    <span>Check active locks in another terminal tab:</span>
                    <CodeBlock code="latch status" language="bash" />
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted text-foreground font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <span>Observe that the lock table lists <code className="text-foreground font-mono">src/auth.ts</code> as exclusively held with active TTL lease.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-destructive/20 text-destructive font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </span>
                  <div className="w-full">
                    <span>If a second agent attempts to edit concurrently, Latch rejects the write before disk modification:</span>
                    <div className="rounded-xl border border-destructive/40 bg-[#0d1117] dark:bg-[#07090d] text-[#c9d1d9] shadow-xl overflow-hidden my-3 font-mono text-xs">
                      <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.03] select-none">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                          <span className="ml-2.5 text-[11px] text-destructive font-mono">
                            stderr — write lock collision
                          </span>
                        </div>
                        <span className="text-[10px] text-destructive/80 font-mono">exit 1</span>
                      </div>
                      <div className="p-3.5 sm:p-4 text-destructive/90 font-mono text-[12.5px] leading-relaxed">
                        [Latch Error] Lock rejected: src/auth.ts is currently held by @developer (agent: claude).<br />
                        Lease expires in 18s.
                      </div>
                    </div>
                  </div>
                </li>
              </ol>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 4: SUPPORTED AGENTS & HOOK PROTOCOL                               */}
            {/* ========================================================================= */}
            <section id="agents" className="scroll-mt-24 pb-12 border-b border-border/60">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-primary font-bold">04</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground tracking-wider uppercase">Interception</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-6">
                Supported Agents & Hook Protocol
              </h2>

              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-left text-xs sm:text-sm font-mono">
                  <thead className="bg-muted/40 border-b border-border/70 text-foreground font-semibold">
                    <tr>
                      <th className="py-3 px-4">Agent</th>
                      <th className="py-3 px-4">Config File</th>
                      <th className="py-3 px-4">Intercepted Tools</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">Claude Code</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">.claude/settings.json</td>
                      <td className="py-3 px-4 text-primary text-xs">Edit, Write, NotebookEdit</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">Cursor IDE</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">.cursor/hooks.json</td>
                      <td className="py-3 px-4 text-primary text-xs">Write, Edit, Delete</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">Codex</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">.codex/hooks.json</td>
                      <td className="py-3 px-4 text-primary text-xs">apply_patch, Edit, Write</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">GitHub Copilot CLI</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">.github/hooks/latch-os.json</td>
                      <td className="py-3 px-4 text-primary text-xs">edit, create</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">Antigravity</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">.agents/hooks.json</td>
                      <td className="py-3 px-4 text-primary text-xs">write_to_file, replace_file_content, multi_replace_file_content</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-muted-foreground italic">
                *Hook files can be safely committed to git so all contributors inherit write arbitration automatically.*
              </p>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 5: CLI REFERENCE                                                  */}
            {/* ========================================================================= */}
            <section id="cli-reference" className="scroll-mt-24 pb-12 border-b border-border/60">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-primary font-bold">05</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground tracking-wider uppercase">Reference</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-8">
                CLI Reference
              </h2>

              <div className="space-y-10">
                {/* Identity */}
                <div>
                  <h3 className="text-xs font-bold text-primary font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Identity Commands
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch login</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Sign in with GitHub identity via <code className="font-mono">gh</code> CLI or device flow.
                      </p>
                      <CodeBlock code="latch login" />
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch whoami</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Displays signed-in GitHub username and active project id.
                      </p>
                      <CodeBlock code="latch whoami" />
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch logout</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Clears local session tokens.
                      </p>
                      <CodeBlock code="latch logout" />
                    </div>
                  </div>
                </div>

                {/* Workspace Management */}
                <div>
                  <h3 className="text-xs font-bold text-primary font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4" /> Workspace Management
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch clone &lt;url&gt; [dir]</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Performs <code className="font-mono">git clone</code>, registers workspace, and installs hooks.
                      </p>
                      <CodeBlock code="latch clone https://github.com/org/repo.git ./my-repo" />
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch add &lt;path&gt;</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Registers existing local folder as Latch workspace and writes hooks.
                      </p>
                      <CodeBlock code="latch add ~/projects/my-app" />
                    </div>
                  </div>
                </div>

                {/* Daemon & Server */}
                <div>
                  <h3 className="text-xs font-bold text-primary font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" /> Daemon & Server
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch serve</h4>
                      <CodeBlock
                        code={`latch serve              # API on :3001, Mission Control on :3002
latch serve --no-ui      # Headless mode: API daemon only
latch serve --port 4001  # Custom daemon port`}
                      />
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch status</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Health check printing daemon connectivity, role (<code className="font-mono">host</code> / <code className="font-mono">guest</code>), and ports.
                      </p>
                      <CodeBlock code="latch status" />
                    </div>
                  </div>
                </div>

                {/* Causal Patch Sync */}
                <div>
                  <h3 className="text-xs font-bold text-primary font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Radio className="w-4 h-4" /> Causal Patch Sync
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch push</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Bundles uncommitted working-tree modifications and broadcasts to active room.
                      </p>
                      <CodeBlock code="latch push" />
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch pull</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Pulls and applies latest uncommitted working-tree changes broadcast by room host.
                      </p>
                      <CodeBlock code="latch pull" />
                    </div>
                  </div>
                </div>

                {/* Diagnostics & MCP */}
                <div>
                  <h3 className="text-xs font-bold text-primary font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Diagnostics & MCP
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch doctor</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Diagnoses daemon health, network connectivity, and hook table mirrors.
                      </p>
                      <CodeBlock code="latch doctor" />
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-semibold text-foreground">latch mcp-url</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Outputs JSON configuration for MCP-compatible clients.
                      </p>
                      <CodeBlock code="latch mcp-url" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 6: USING MISSION CONTROL DASHBOARD                                */}
            {/* ========================================================================= */}
            <section id="mission-control" className="scroll-mt-24 pb-12 border-b border-border/60">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-primary font-bold">06</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground tracking-wider uppercase">Studio</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-6">
                Mission Control Studio (Port :3002)
              </h2>

              {/* Wireframe Mockup Preview */}
              <div className="rounded-xl border border-border/80 bg-[#0d1117] dark:bg-[#07090d] text-[#c9d1d9] shadow-xl overflow-hidden mb-6 font-mono text-xs">
                <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.03] select-none">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                    <span className="ml-2.5 text-[11px] text-white/50 font-mono">
                      http://localhost:3002 — Mission Control Studio
                    </span>
                  </div>
                  <span className="text-emerald-400 text-[11px] flex items-center gap-1.5 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Daemon :3001 Live
                  </span>
                </div>
                <div className="p-4 sm:p-5 font-mono text-xs space-y-3">
                  <div className="text-white/80 font-semibold text-[11px] uppercase tracking-wider">▼ Active Workspaces (3 Active)</div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      backend-api · ACTIVE SWARM
                    </span>
                    <span className="text-white/50 text-[11px]">4 Agents · AST Bus Online</span>
                  </div>
                  <div className="text-white/80 font-semibold text-[11px] uppercase tracking-wider mt-3">▼ Blocked Workspaces (1 Contested)</div>
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between text-xs text-red-300">
                    <span className="font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      auth-service · MUTEX BLOCKED
                    </span>
                    <span className="text-red-400/80 text-[11px]">Contested write rejected</span>
                  </div>
                </div>
              </div>

              {/* Feature Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-card/40 border border-border/70">
                  <h4 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                    Lock Leases Table
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Real-time table of active file locks, owning agent handle, and countdown TTL expiration timers.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-card/40 border border-border/70">
                  <h4 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                    AST Blast-Radius Visualizer
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Interactive module boundary graph showing which downstream dependency callers are locked.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-card/40 border border-border/70">
                  <h4 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                    Causal Event Stream
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Real-time chronological audit log of file claims, releases, AST warnings, and patch broadcasts.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-card/40 border border-border/70">
                  <h4 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                    Room Sharing & Presence
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    End-to-end encrypted invite links, team member tokens, and peer latency status across swarms.
                  </p>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 7: USING THE MCP CONTEXT SERVER                                   */}
            {/* ========================================================================= */}
            <section id="mcp" className="scroll-mt-24 pb-12 border-b border-border/60">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-primary font-bold">07</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground tracking-wider uppercase">Context Protocol</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-6">
                Using the MCP Context Server
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-primary font-mono uppercase tracking-wider mb-2">
                    1. Retrieve Configuration
                  </h3>
                  <CodeBlock code="latch mcp-url" language="bash" />
                </div>

                <div>
                  <h3 className="text-xs font-bold text-primary font-mono uppercase tracking-wider mb-2">
                    2. Configure Your MCP Client
                  </h3>
                  <CodeBlock
                    title="claude_desktop_config.json"
                    language="json"
                    code={`{
  "mcpServers": {
    "latch-room": {
      "type": "http",
      "url": "https://<your-ngrok-tunnel>.ngrok-free.app/mcp",
      "headers": {
        "ngrok-skip-browser-warning": "latch",
        "x-latch-room-token": "rmt_your_room_token"
      }
    }
  }
}`}
                  />
                </div>

                <div>
                  <h3 className="text-xs font-bold text-primary font-mono uppercase tracking-wider mb-3">
                    3. Exposed MCP Tools
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-card/50 border border-border/70 font-mono">
                      <span className="font-bold text-primary">latch_claim_file</span>
                      <p className="text-muted-foreground text-[11px] mt-1">Acquire exclusive lock before editing.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/50 border border-border/70 font-mono">
                      <span className="font-bold text-primary">latch_release_file</span>
                      <p className="text-muted-foreground text-[11px] mt-1">Release lock after write completes.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/50 border border-border/70 font-mono">
                      <span className="font-bold text-primary">latch_status</span>
                      <p className="text-muted-foreground text-[11px] mt-1">Inspect active locks & blast radiuses.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/50 border border-border/70 font-mono">
                      <span className="font-bold text-primary">latch_get_conflicts</span>
                      <p className="text-muted-foreground text-[11px] mt-1">Query AST collisions in past 5 mins.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/50 border border-border/70 font-mono">
                      <span className="font-bold text-primary">latch_get_recent_changes</span>
                      <p className="text-muted-foreground text-[11px] mt-1">Real-time code edit event stream.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/50 border border-border/70 font-mono">
                      <span className="font-bold text-primary">latch_report_decision</span>
                      <p className="text-muted-foreground text-[11px] mt-1">Coordinate architecture choices.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/50 border border-border/70 font-mono">
                      <span className="font-bold text-primary">latch_update_task</span>
                      <p className="text-muted-foreground text-[11px] mt-1">Synchronize swarm task backlog.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/50 border border-border/70 font-mono">
                      <span className="font-bold text-primary">latch_get_chat_history</span>
                      <p className="text-muted-foreground text-[11px] mt-1">Access unified swarm transcripts.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 8: CONFIGURATION & ENVIRONMENT VARIABLES                          */}
            {/* ========================================================================= */}
            <section id="config" className="scroll-mt-24 pb-12 border-b border-border/60">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-primary font-bold">08</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground tracking-wider uppercase">Configuration</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-6">
                Environment Variables
              </h2>

              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-left text-xs sm:text-sm font-mono">
                  <thead className="bg-muted/40 border-b border-border/70 text-foreground font-semibold">
                    <tr>
                      <th className="py-3 px-4">Variable</th>
                      <th className="py-3 px-4">Default</th>
                      <th className="py-3 px-4">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">LATCH_PORT</td>
                      <td className="py-3 px-4 text-muted-foreground">3001</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">Local coordination API daemon port</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">LATCH_UI_PORT</td>
                      <td className="py-3 px-4 text-muted-foreground">3002</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">Mission Control web dashboard port</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">LATCH_UI_ORIGIN</td>
                      <td className="py-3 px-4 text-muted-foreground">http://localhost:3002</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">Allowed CORS origin for dashboard requests</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">GITHUB_CLIENT_ID</td>
                      <td className="py-3 px-4 text-muted-foreground">Optional</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">GitHub OAuth app ID for device-flow authentication</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">GITHUB_CLIENT_SECRET</td>
                      <td className="py-3 px-4 text-muted-foreground">Optional</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">GitHub OAuth secret for hosted login gates</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold text-foreground">DEBUG</td>
                      <td className="py-3 px-4 text-muted-foreground">false</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">Enable verbose debug logging for AST graph parsing</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 9: TROUBLESHOOTING & DIAGNOSTICS                                  */}
            {/* ========================================================================= */}
            <section id="troubleshooting" className="scroll-mt-24 pb-12">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-primary font-bold">09</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground tracking-wider uppercase">Diagnostics</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-6">
                Troubleshooting
              </h2>

              <CodeBlock code="latch doctor" language="bash" />

              <div className="divide-y divide-border/60 mt-6">
                <div className="py-5">
                  <h4 className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-destructive" /> 1. offline — run latch serve
                  </h4>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    <strong className="text-foreground">Cause:</strong> No daemon process is responding on port 3001.<br />
                    <strong className="text-foreground">Fix:</strong> Run <code className="font-mono text-foreground bg-muted/50 px-1 py-0.5 rounded">latch serve</code> in a terminal window, or check port 3001 via <code className="font-mono text-foreground bg-muted/50 px-1 py-0.5 rounded">lsof -i :3001</code>.
                  </p>
                </div>

                <div className="py-5">
                  <h4 className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> 2. The Board is Empty but Agent Locking Works
                  </h4>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    <strong className="text-foreground">Cause:</strong> Hooks call daemon API directly over HTTP, whereas the dashboard is updated by the lock mirror.<br />
                    <strong className="text-foreground">Fix:</strong> Restart <code className="font-mono text-foreground bg-muted/50 px-1 py-0.5 rounded">latch serve</code> on your machine to refresh the SSE stream.
                  </p>
                </div>

                <div className="py-5">
                  <h4 className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-destructive" /> 3. Agent Edits Without Claiming Locks
                  </h4>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    <strong className="text-foreground">Cause:</strong> The workspace was cloned using raw <code className="font-mono text-foreground bg-muted/50 px-1 py-0.5 rounded">git clone</code> instead of <code className="font-mono text-foreground bg-muted/50 px-1 py-0.5 rounded">latch clone</code>, so hooks were not written.<br />
                    <strong className="text-foreground">Fix:</strong> Run <code className="font-mono text-foreground bg-muted/50 px-1 py-0.5 rounded">latch add .</code> inside repository root to install hooks.
                  </p>
                </div>

                <div className="py-5">
                  <h4 className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> 4. cannot reach the host (Guests)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    <strong className="text-foreground">Cause:</strong> The host machine closed their laptop, restarted the daemon, or the ngrok tunnel URL refreshed.<br />
                    <strong className="text-foreground">Fix:</strong> Have the host copy the updated invite link from Mission Control (<strong>Team → Share</strong>) and re-join with <code className="font-mono text-foreground bg-muted/50 px-1 py-0.5 rounded">latch pull</code>.
                  </p>
                </div>
              </div>
            </section>

            {/* Ready to coordinate CTA - Open Clean Section */}
            <div className="py-12 border-t border-border/80 text-center relative overflow-hidden">
              <div className="relative z-10 max-w-xl mx-auto space-y-4">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  Ready to Coordinate Your Swarm?
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Launch Mission Control to monitor real-time lock leases, AST blast radiuses, and agent activity.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                  <Link
                    href="/dashboard"
                    className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <span>Launch Cockpit Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/"
                    className="px-6 py-2.5 rounded-xl bg-muted/50 text-foreground border border-border/80 font-semibold text-xs sm:text-sm hover:bg-muted transition-colors"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Interactive Halftone Wordmark Footer */}
      <div className="border-t border-border">
        <HalftoneWordmarkFooter
          wordmark="latch"
          label="Latch Systems"
          meta="©2026 · Machine-Speed Coordination Layer"
          preset={isDark ? "night" : "paper"}
          crop={0}
          palette={
            isDark
              ? {
                  background: "#111111",
                  ink: "#eeeeee",
                  warm: "#ffe0c2",
                }
              : {
                  background: "#f9f9f9",
                  ink: "#202020",
                  warm: "#644a40",
                }
          }
        />
      </div>
    </div>
  );
}
