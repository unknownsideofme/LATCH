"use client";

import { Shield, Network, GitMerge, BrainCircuit, ArrowUpRight } from "lucide-react";

const pillars = [
  {
    num: "01",
    title: "Exclusive File Locks",
    subtitle: "P2P ZERO-COLLISION MUTEX",
    description:
      "When Cursor, Claude Code, or Codex edits a file, Latch grants a short-lived lease with active heartbeat renewal. Concurrent agents are paused or routed around the locked file.",
    icon: <Shield className="w-5 h-5 text-primary" />,
    specs: ["Sub-millisecond lease acquisition", "Auto-expiry TTL safety net", "Pre-flight claim verification"],
  },
  {
    num: "02",
    title: "Blast Radius AST Analysis",
    subtitle: "DEPENDENCY GRAPH PARSING",
    description:
      "Changing an interface signature shouldn't break other parallel agents. Latch parses the codebase AST graph and manages locks across dependent symbol hierarchies.",
    icon: <Network className="w-5 h-5 text-primary" />,
    specs: ["Tree-sitter AST parser", "Upstream & downstream lock propagation", "Cross-agent intent warning"],
  },
  {
    num: "03",
    title: "Causal Patch Synchronization",
    subtitle: "LAMPORT VECTOR CLOCKS",
    description:
      "Patches broadcast across local sockets or Supabase channels. Git coordinates commits minutes apart; Latch synchronizes in-flight file edits in real time.",
    icon: <GitMerge className="w-5 h-5 text-primary" />,
    specs: ["Causal ordering verification", "Instant disk reload via Stop Hooks", "Zero phantom overwrites"],
  },
  {
    num: "04",
    title: "Shared Agent Memory Ledger",
    subtitle: "CROSS-SESSION PERSISTENCE",
    description:
      "Tool invocations, test failures, and architectural decisions are indexed in shared agent memory. New agents inherit full codebase context immediately.",
    icon: <BrainCircuit className="w-5 h-5 text-primary" />,
    specs: ["Compile brief summaries", "Live file lock audit log", "Stop hook automatic synchronization"],
  },
];

export function FourPillarsGrid() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border mb-8">
        <div>
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-primary">
            Core Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-[var(--font-display)] font-bold text-foreground mt-1 tracking-tight">
            Engineered for Multi-Agent Swarms
          </h2>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-muted-foreground font-[var(--font-body)]">
          Four synchronization primitives designed for simultaneous autonomy across heterogeneous models.
        </p>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {pillars.map((item, idx) => (
          <div
            key={idx}
            className="group relative p-6 sm:p-7 rounded-lg bg-card border border-border hover:border-ring transition-all duration-200 flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded bg-muted border border-border">
                    {item.icon}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Pillar {item.num} // {item.subtitle}
                    </span>
                    <h3 className="text-base sm:text-lg font-[var(--font-display)] font-bold text-foreground mt-0.5">
                      {item.title}
                    </h3>
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Micro Specs List */}
            <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-2">
              {item.specs.map((spec, sIdx) => (
                <span
                  key={sIdx}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border"
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
