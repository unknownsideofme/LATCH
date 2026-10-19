"use client";

import { Shield, Network, GitMerge, BrainCircuit, ArrowUpRight } from "lucide-react";

const pillars = [
  {
    num: "01",
    title: "Exclusive File Locks",
    subtitle: "P2P ZERO-COLLISION MUTEX",
    description:
      "When Cursor, Claude Code, or Codex edits a file, Latch grants a short-lived lease with active heartbeat renewal. Concurrent agents are paused or routed around the locked file.",
    icon: <Shield className="w-5 h-5 text-[#3ECF8E]" />,
    specs: ["Sub-millisecond lease acquisition", "Auto-expiry TTL safety net", "Pre-flight claim verification"],
  },
  {
    num: "02",
    title: "Blast Radius AST Analysis",
    subtitle: "DEPENDENCY GRAPH PARSING",
    description:
      "Changing an interface signature shouldn't break other parallel agents. Latch parses the codebase AST graph and manages locks across dependent symbol hierarchies.",
    icon: <Network className="w-5 h-5 text-[#3ECF8E]" />,
    specs: ["Tree-sitter AST parser", "Upstream & downstream lock propagation", "Cross-agent intent warning"],
  },
  {
    num: "03",
    title: "Causal Patch Synchronization",
    subtitle: "LAMPORT VECTOR CLOCKS",
    description:
      "Patches broadcast across local sockets or Supabase channels. Git coordinates commits minutes apart; Latch synchronizes in-flight file edits in real time.",
    icon: <GitMerge className="w-5 h-5 text-[#3ECF8E]" />,
    specs: ["Causal ordering verification", "Instant disk reload via Stop Hooks", "Zero phantom overwrites"],
  },
  {
    num: "04",
    title: "Shared Agent Memory Ledger",
    subtitle: "CROSS-SESSION PERSISTENCE",
    description:
      "Tool invocations, test failures, and architectural decisions are indexed in shared agent memory. New agents inherit full codebase context immediately.",
    icon: <BrainCircuit className="w-5 h-5 text-[#3ECF8E]" />,
    specs: ["Compile brief summaries", "Live file lock audit log", "Stop hook automatic synchronization"],
  },
];

export function FourPillarsGrid() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#262C34] mb-8">
        <div>
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#3ECF8E]">
            Core Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-[var(--font-display)] font-bold text-[#F0F3F6] mt-1 tracking-tight">
            Engineered for Multi-Agent Swarms
          </h2>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-[#8B949E] font-[var(--font-body)]">
          Four synchronization primitives designed for simultaneous autonomy across heterogeneous models.
        </p>
      </div>

      {/* 2x2 Clean Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pillars.map((pillar) => (
          <div
            key={pillar.num}
            className="group relative bg-[#12161C] border border-[#262C34] rounded-lg p-6 hover:border-[#3ECF8E]/40 hover:bg-[#161B22] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded bg-[#0B0E11] border border-[#262C34]">
                  {pillar.icon}
                </div>
                <span className="font-mono text-sm font-semibold text-[#8B949E] group-hover:text-[#3ECF8E] transition-colors">
                  {pillar.num}
                </span>
              </div>

              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block mb-1">
                {pillar.subtitle}
              </span>
              <h3 className="text-lg font-[var(--font-display)] font-semibold text-[#F0F3F6] tracking-tight">
                {pillar.title}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-[#8B949E] leading-relaxed">
                {pillar.description}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#262C34] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {pillar.specs.map((spec, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0B0E11] text-[#8B949E] border border-[#262C34]"
                  >
                    {spec}
                  </span>
                ))}
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#8B949E] group-hover:text-[#3ECF8E] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
