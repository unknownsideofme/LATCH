"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Lock,
  Clock,
  Zap,
  FileCode2,
  GitBranch,
} from "lucide-react";

type LineIconType = "lock" | "clock" | "shield" | "check" | "error" | "conflict";

interface CodeLine {
  num: number;
  content: string;
  type?: "normal" | "conflict-marker" | "conflict-body" | "error" | "lock-banner" | "success";
  icon?: LineIconType;
}

interface ScenarioData {
  id: string;
  name: string;
  file: string;
  summary: {
    problem: {
      headline: string;
      desc: string;
      resultBadge: string;
      agents: string;
      lines: CodeLine[];
    };
    solution: {
      headline: string;
      desc: string;
      resultBadge: string;
      agents: string;
      lines: CodeLine[];
    };
  };
}

const SCENARIOS: ScenarioData[] = [
  {
    id: "concurrent-write",
    name: "01 Concurrent Write",
    file: "src/auth.ts",
    summary: {
      problem: {
        headline: "Silent Overwrite & Conflict",
        desc: "Cursor and Claude Code save auth.ts at the exact same millisecond. Claude's write clobbers Cursor's edits, generating corrupt git merge markers.",
        resultBadge: "Merge Collision · Build Halted",
        agents: "Cursor + Claude Code (Racing)",
        lines: [
          { num: 1, content: "import { decodeRawJWT } from \"./jwt\";", type: "normal" },
          { num: 2, content: "", type: "normal" },
          { num: 3, content: "<<<<<<< Claude Code (Rewrite session handler)", type: "conflict-marker", icon: "conflict" },
          { num: 4, content: "export async function getSession(req: Request) {", type: "conflict-body" },
          { num: 5, content: "  return await verifyToken(req.headers.get(\"authorization\"));", type: "conflict-body" },
          { num: 6, content: "}", type: "conflict-body" },
          { num: 7, content: "=======", type: "conflict-marker" },
          { num: 8, content: "export async function getSession(jwt: string) {", type: "conflict-body" },
          { num: 9, content: "  return decodeRawJWT(jwt); // Inlined token parser", type: "conflict-body" },
          { num: 10, content: "}", type: "conflict-body" },
          { num: 11, content: ">>>>>>> Cursor", type: "conflict-marker", icon: "conflict" },
          { num: 12, content: "TS2304: Cannot find name 'verifyToken'. Git working tree corrupt.", type: "error", icon: "error" },
        ],
      },
      solution: {
        headline: "Atomic Sub-0.4ms Lease",
        desc: "Latch grants Cursor an exclusive 15s write lease in 0.38ms. Claude Code's write is held safely in queue, then applied cleanly without conflicts.",
        resultBadge: "Zero Conflict · Clean Build",
        agents: "Cursor -> Claude Code (Ordered)",
        lines: [
          { num: 1, content: "LATCH MUTEX ACTIVE: Exclusive lease #8f9a2 held by Cursor (0.38ms grant)", type: "lock-banner", icon: "lock" },
          { num: 2, content: "Claude Code write held in queue until lock releases", type: "lock-banner", icon: "clock" },
          { num: 3, content: "import { verifySessionToken } from \"./jwt\";", type: "normal" },
          { num: 4, content: "", type: "normal" },
          { num: 5, content: "export async function getSession(req: Request) {", type: "normal" },
          { num: 6, content: "  const token = req.headers.get(\"authorization\")?.replace(\"Bearer \", \"\");", type: "normal" },
          { num: 7, content: "  if (!token) return null;", type: "normal" },
          { num: 8, content: "  return await verifySessionToken(token);", type: "normal" },
          { num: 9, content: "}", type: "normal" },
          { num: 10, content: "Lease released · Patch broadcasted via vector clock in 3.8ms", type: "success", icon: "check" },
        ],
      },
    },
  },
  {
    id: "ast-interface",
    name: "02 Broken Export",
    file: "src/types/user.ts",
    summary: {
      problem: {
        headline: "Downstream AST Break",
        desc: "Codex removes a deprecated interface while Copilot concurrently writes a route depending on it, causing immediate compiler failure.",
        resultBadge: "TS2305 Missing Member",
        agents: "Codex + Copilot (Unaware)",
        lines: [
          { num: 1, content: "export interface UserProfile {", type: "normal" },
          { num: 2, content: "  id: string;", type: "normal" },
          { num: 3, content: "  name: string;", type: "normal" },
          { num: 4, content: "}", type: "normal" },
          { num: 5, content: "", type: "normal" },
          { num: 6, content: "Codex deleted UserSession while Copilot wrote route:", type: "error", icon: "error" },
          { num: 7, content: "- export interface UserSession { token: string }", type: "conflict-marker", icon: "conflict" },
          { num: 8, content: "", type: "normal" },
          { num: 9, content: "error TS2305: Module has no exported member 'UserSession'.", type: "error", icon: "error" },
          { num: 10, content: "3 dependent agent tasks crashed across working tree.", type: "error", icon: "error" },
        ],
      },
      solution: {
        headline: "AST Blast-Radius Guard",
        desc: "Tree-sitter AST analysis intercepts the delete operation, recognizing active references across parallel agents and safely preserving compatibility.",
        resultBadge: "AST Guarded · 0 Breaks",
        agents: "Codex -> Latch AST -> Copilot",
        lines: [
          { num: 1, content: "LATCH AST GUARD: 2 running agents depend on UserSession symbol", type: "lock-banner", icon: "shield" },
          { num: 2, content: "Destructive deletion intercepted · Compatibility alias created", type: "lock-banner", icon: "lock" },
          { num: 3, content: "export interface UserProfile {", type: "normal" },
          { num: 4, content: "  id: string;", type: "normal" },
          { num: 5, content: "  name: string;", type: "normal" },
          { num: 6, content: "}", type: "normal" },
          { num: 7, content: "", type: "normal" },
          { num: 8, content: "// Preserved backward-compatible export alias during swarm session:", type: "normal" },
          { num: 9, content: "export type UserSession = UserProfile & { token: string };", type: "success", icon: "check" },
          { num: 10, content: "AST dependency intact · 0 downstream compiler errors", type: "success", icon: "check" },
        ],
      },
    },
  },
  {
    id: "multi-agent-race",
    name: "03 Three-Agent Race",
    file: "src/checkout.ts",
    summary: {
      problem: {
        headline: "Cascading 3-Way Stash Clash",
        desc: "Three agents concurrently inject Stripe, PayPal, and error-handling code into the exact same function block, leaving git in an unmergeable state.",
        resultBadge: "Corrupted Git Tree",
        agents: "Cursor + Claude + Antigravity",
        lines: [
          { num: 1, content: "FATAL 3-WAY STASH COLLISION on checkout.ts", type: "error", icon: "error" },
          { num: 2, content: "<<<<<<< Cursor: initStripe(process.env.STRIPE_KEY)", type: "conflict-marker", icon: "conflict" },
          { num: 3, content: "=======", type: "conflict-marker" },
          { num: 4, content: "<<<<<<< Claude Code: initPayPal(config)", type: "conflict-marker", icon: "conflict" },
          { num: 5, content: "=======", type: "conflict-marker" },
          { num: 6, content: "initCheckoutErrorCapture(err);", type: "conflict-body" },
          { num: 7, content: ">>>>>>> Antigravity", type: "conflict-marker", icon: "conflict" },
          { num: 8, content: ">>>>>>> Cursor", type: "conflict-marker", icon: "conflict" },
          { num: 9, content: "3-way merge conflict. Pipeline destroyed. Manual fix required.", type: "error", icon: "error" },
        ],
      },
      solution: {
        headline: "Causally Merged Swarm",
        desc: "Latch coordinates exclusive serial leases across all three agents, sequencing each contribution into a unified, conflict-free commit.",
        resultBadge: "100% Parallel Pass",
        agents: "Cursor -> Claude -> Antigravity",
        lines: [
          { num: 1, content: "LATCH MUTEX PIPELINE: Leases sequenced #1 -> #2 -> #3", type: "lock-banner", icon: "lock" },
          { num: 2, content: "All 3 agent edits causally merged through vector clock channel", type: "lock-banner", icon: "shield" },
          { num: 3, content: "export async function processOrder(order: OrderPayload) {", type: "normal" },
          { num: 4, content: "  const stripe = await initStripeClient(); // Cursor (Lease #1)", type: "normal" },
          { num: 5, content: "  const paypal = await initPayPalFallback(); // Claude Code (Lease #2)", type: "normal" },
          { num: 6, content: "  return await dispatchPayment(order, { stripe, paypal }); // Antigravity (#3)", type: "normal" },
          { num: 7, content: "}", type: "normal" },
          { num: 8, content: "All 3 agents completed work concurrently with 0 clobbers", type: "success", icon: "check" },
        ],
      },
    },
  },
];

export function ProblemSolutionSplit() {
  const [activeTab, setActiveTab] = useState<"problem" | "solution">("problem");
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);

  const scenario = SCENARIOS[selectedScenarioIndex];
  const view = activeTab === "problem" ? scenario.summary.problem : scenario.summary.solution;

  // Render SVG icons instead of Unicode emojis
  const renderLineIcon = (icon?: LineIconType) => {
    if (!icon) return null;
    switch (icon) {
      case "lock":
        return <Lock className="w-3.5 h-3.5 text-primary inline-block mr-1.5 shrink-0 align-middle" />;
      case "clock":
        return <Clock className="w-3.5 h-3.5 text-primary/80 inline-block mr-1.5 shrink-0 align-middle" />;
      case "shield":
        return <ShieldCheck className="w-3.5 h-3.5 text-primary inline-block mr-1.5 shrink-0 align-middle" />;
      case "check":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline-block mr-1.5 shrink-0 align-middle" />;
      case "error":
        return <XCircle className="w-3.5 h-3.5 text-destructive inline-block mr-1.5 shrink-0 align-middle" />;
      case "conflict":
        return <AlertTriangle className="w-3.5 h-3.5 text-destructive inline-block mr-1.5 shrink-0 align-middle" />;
      default:
        return null;
    }
  };

  // Syntax tokenizer for TS code
  const renderHighlightedCode = (text: string, type?: string, icon?: LineIconType) => {
    if (!text) return <span>&nbsp;</span>;

    const iconNode = renderLineIcon(icon);

    if (type === "conflict-marker") {
      return (
        <span className="font-bold text-destructive select-none inline-flex items-center">
          {iconNode}
          <span>{text}</span>
        </span>
      );
    }
    if (type === "error") {
      return (
        <span className="text-destructive/90 font-mono font-medium inline-flex items-center">
          {iconNode}
          <span>{text}</span>
        </span>
      );
    }
    if (type === "lock-banner") {
      return (
        <span className="text-primary font-mono font-medium inline-flex items-center">
          {iconNode}
          <span>{text}</span>
        </span>
      );
    }
    if (type === "success") {
      return (
        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium inline-flex items-center">
          {iconNode}
          <span>{text}</span>
        </span>
      );
    }

    const parts = text.split(/(\b(?:export|async|function|return|import|from|const|let|await|if|type|interface)\b|"[^"]*"|'[^']*'|\/\/.*$)/g);

    return (
      <span className="inline-flex items-center">
        {iconNode}
        <span>
          {parts.map((part, i) => {
            if (!part) return null;
            if (part.startsWith("//")) {
              return <span key={i} className="text-muted-foreground/70 italic">{part}</span>;
            }
            if (part.startsWith("\"") || part.startsWith("'")) {
              return <span key={i} className="text-emerald-600 dark:text-emerald-400 font-medium">{part}</span>;
            }
            if (/^(?:export|async|function|return|import|from|const|let|await|if|type|interface)$/.test(part)) {
              return <span key={i} className="text-primary font-semibold">{part}</span>;
            }
            return <span key={i} className="text-foreground/90">{part}</span>;
          })}
        </span>
      </span>
    );
  };

  return (
    <section id="problem-solution" className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-20">
      {/* Header with restored Library 3 AM font */}
      <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border text-[11px] font-mono text-primary uppercase tracking-wider mb-3 shadow-xs"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Interactive Architectural Sandbox</span>
        </motion.div>

        {/* Heading restoring the original font-library3am styling */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-sans leading-snug">
          Humans commit minutes apart. <br className="hidden sm:inline" />
          <span className="text-primary font-library3am tracking-wide uppercase">
            AI agents commit milliseconds apart.
          </span>
        </h2>

        <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Toggle between the failure mode of blind agent swarms and Latch&apos;s machine-speed mutex coordination layer.
        </p>

        {/* Animated Segmented Mode Switcher */}
        <div className="mt-6 inline-flex p-1 rounded-xl bg-card border border-border shadow-sm relative">
          <button
            onClick={() => setActiveTab("problem")}
            className={`relative z-10 flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "problem" ? "text-destructive font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === "problem" && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 rounded-lg bg-destructive/15 border border-destructive/35 -z-10 shadow-xs"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span>01 The Problem (Agent Chaos)</span>
          </button>
          <button
            onClick={() => setActiveTab("solution")}
            className={`relative z-10 flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "solution" ? "text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === "solution" && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 rounded-lg bg-primary -z-10 shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>02 The Solution (Latch Mutex)</span>
          </button>
        </div>
      </div>

      {/* Main Animated Workbench Container */}
      <motion.div
        layout
        transition={{ duration: 0.3 }}
        className={`rounded-2xl border transition-colors duration-300 overflow-hidden bg-card/95 shadow-xl relative ${
          activeTab === "problem" ? "border-destructive/35" : "border-primary/35"
        }`}
      >
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/40 backdrop-blur-xs">
          {/* Scenario Tabs */}
          <div className="flex items-center gap-1.5">
            {SCENARIOS.map((sc, idx) => (
              <button
                key={sc.id}
                onClick={() => setSelectedScenarioIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  selectedScenarioIndex === idx
                    ? activeTab === "problem"
                      ? "text-destructive font-semibold bg-destructive/15 border border-destructive/30"
                      : "text-primary font-semibold bg-primary/15 border border-primary/30"
                    : "text-muted-foreground hover:text-foreground bg-transparent"
                }`}
              >
                {sc.name}
              </button>
            ))}
          </div>

          {/* Target File Badge */}
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>Target:</span>
            <span className="px-2 py-0.5 rounded bg-muted text-foreground border border-border font-medium flex items-center gap-1.5">
              <FileCode2 className="w-3 h-3 text-primary" />
              {scenario.file}
            </span>
          </div>
        </div>

        {/* 2-Column Clean Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[400px]">
          
          {/* Left Summary Briefing (4 Cols) */}
          <div className="lg:col-span-4 p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-between bg-muted/10">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedScenarioIndex}-${activeTab}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Status Pill */}
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
                    activeTab === "problem"
                      ? "bg-destructive/10 text-destructive border-destructive/25"
                      : "bg-primary/10 text-primary border-primary/25"
                  }`}>
                    {activeTab === "problem" ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span>{view.resultBadge}</span>
                  </span>
                </div>

                {/* Headline */}
                <h3 className="text-lg font-bold text-foreground tracking-tight">
                  {view.headline}
                </h3>

                {/* Minimal 1-Sentence Summary */}
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {view.desc}
                </p>

                {/* Quick Info Grid */}
                <div className="space-y-2 pt-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between">
                    <span className="text-muted-foreground">Active Swarm:</span>
                    <span className="font-semibold text-foreground">{view.agents}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between">
                    <span className="text-muted-foreground">Lock Protocol:</span>
                    <span className={activeTab === "problem" ? "text-destructive font-semibold" : "text-primary font-semibold"}>
                      {activeTab === "problem" ? "None (Direct Disk)" : "Sub-0.4ms Mutex"}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Bottom State Callout */}
            <div className="mt-6 pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>Latch Arbiter</span>
              <span className={`flex items-center gap-1.5 font-semibold ${
                activeTab === "problem" ? "text-destructive" : "text-primary"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  activeTab === "problem" ? "bg-destructive" : "bg-primary"
                }`} />
                {activeTab === "problem" ? "Clobber Detected" : "100% Conflict-Free"}
              </span>
            </div>
          </div>

          {/* Right Real Code Editor (8 Cols) */}
          <div className="lg:col-span-8 p-3 sm:p-4 bg-muted/20 dark:bg-[#0a0a0a] flex flex-col justify-between font-mono transition-colors">
            {/* Editor Window Chrome */}
            <div className="rounded-xl border border-border dark:border-white/10 bg-card dark:bg-[#121212] overflow-hidden shadow-sm dark:shadow-inner flex flex-col h-full transition-colors">
              {/* Editor Tab Bar */}
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-border dark:border-white/10 bg-muted/50 dark:bg-[#181818] select-none text-xs transition-colors">
                <div className="flex items-center gap-3">
                  {/* Traffic lights */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80" />
                  </div>
                  {/* File Tab */}
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-background dark:bg-[#202020] text-foreground dark:text-white/90 border border-border dark:border-white/10 text-xs font-mono shadow-2xs">
                    <FileCode2 className="w-3.5 h-3.5 text-primary" />
                    <span>{scenario.file}</span>
                  </div>
                </div>

                {/* Editor State Badge with Micro-Animation */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="text-[11px] font-mono flex items-center gap-1.5"
                  >
                    {activeTab === "problem" ? (
                      <span className="text-destructive font-semibold flex items-center gap-1 bg-destructive/15 px-2 py-0.5 rounded border border-destructive/30 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                        MERGE CONFLICT
                      </span>
                    ) : (
                      <span className="text-primary font-semibold flex items-center gap-1 bg-primary/15 px-2 py-0.5 rounded border border-primary/30">
                        <Lock className="w-3 h-3 text-primary" />
                        MUTEX PROTECTED
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Code Line Canvas with Staggered Motion */}
              <div className="p-3 sm:p-4 overflow-x-auto text-xs sm:text-[13px] leading-relaxed flex-1 select-text">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${selectedScenarioIndex}-${activeTab}`}
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: { staggerChildren: 0.02 },
                      },
                    }}
                    className="min-w-[500px]"
                  >
                    {view.lines.map((line) => {
                      const isConflict = line.type === "conflict-marker" || line.type === "conflict-body";
                      const isError = line.type === "error";
                      const isBanner = line.type === "lock-banner";
                      const isSuccess = line.type === "success";

                      return (
                        <motion.div
                          key={line.num}
                          variants={{
                            hidden: { opacity: 0, x: -4 },
                            visible: { opacity: 1, x: 0 },
                          }}
                          transition={{ duration: 0.15 }}
                          className={`flex items-start rounded px-1.5 py-0.5 transition-colors ${
                            isConflict
                              ? "bg-destructive/15 border-l-2 border-destructive"
                              : isError
                              ? "bg-destructive/10 border-l-2 border-destructive"
                              : isBanner
                              ? "bg-primary/10 border-l-2 border-primary"
                              : isSuccess
                              ? "bg-emerald-500/10 border-l-2 border-emerald-600 dark:border-emerald-400"
                              : "hover:bg-muted/50 dark:hover:bg-white/5"
                          }`}
                        >
                          {/* Line Number Gutter */}
                          <span className="w-7 select-none text-right pr-3 shrink-0 text-muted-foreground/50 dark:text-white/30 text-[11px] pt-0.5 font-mono">
                            {line.num}
                          </span>

                          {/* Code Line Content with Icons */}
                          <div className="flex-1 whitespace-pre font-mono">
                            {renderHighlightedCode(line.content, line.type, line.icon)}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Editor Bottom Status Bar */}
              <div className="px-3 py-1.5 border-t border-border dark:border-white/10 bg-muted/30 dark:bg-[#141414] text-[10px] text-muted-foreground dark:text-white/50 flex items-center justify-between select-none transition-colors">
                <div className="flex items-center gap-3">
                  <span>UTF-8</span>
                  <span>TypeScript</span>
                  <span>LF</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={activeTab === "problem" ? "text-destructive" : "text-primary font-medium"}>
                    {activeTab === "problem" ? "● 1 Conflict, TS2304" : "● 0 Conflicts, Valid Mutex"}
                  </span>
                </div>
              </div>

            </div>
          </div>

        </div>

      </motion.div>
    </section>
  );
}
