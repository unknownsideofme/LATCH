"use client";

import { X, Check, AlertOctagon, Shield, Network, Eye, GitPullRequest } from "lucide-react";

export function ProblemSolutionSplit() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 01: The Problem */}
        <div className="rounded-lg bg-[#12161C] border border-[#262C34] p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#DA7756]">
                01 // The Problem
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-[var(--font-display)] font-bold text-[#F0F3F6] tracking-tight">
              AI agents are fast. But they don't coordinate.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#8B949E] leading-relaxed">
              When multiple agents edit the same repository in parallel, they overwrite each other's changes, hallucinate broken AST interfaces, and destroy work.
            </p>

            {/* Problem Checklist */}
            <div className="mt-6 space-y-2.5 text-xs text-[#F0F3F6]">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/30 flex items-center justify-center text-[10px] shrink-0">
                  ✕
                </span>
                <span>No filesystem lock coordination</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/30 flex items-center justify-center text-[10px] shrink-0">
                  ✕
                </span>
                <span>Zero awareness of other running agents</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/30 flex items-center justify-center text-[10px] shrink-0">
                  ✕
                </span>
                <span>Silent code clobbering & broken builds</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/30 flex items-center justify-center text-[10px] shrink-0">
                  ✕
                </span>
                <span>Designed for solo developers, not agent swarms</span>
              </div>
            </div>
          </div>

          {/* Merge Conflict Code Card Inset */}
          <div className="mt-6 p-3.5 rounded bg-[#0B0E11] border border-[#DA7756]/40 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-[#DA7756] text-[10px] font-bold uppercase mb-2">
              <AlertOctagon className="w-3.5 h-3.5" />
              Merge Conflict Detected (No Latch)
            </div>
            <div className="space-y-1 text-[11px] leading-relaxed">
              <div className="text-[#8B949E]">// src/auth.ts · concurrent edits clobbered</div>
              <div className="text-[#DA7756] bg-[#DA7756]/10 px-1 py-0.5 rounded">
                &lt;&lt;&lt;&lt;&lt;&lt;&lt; Claude Code: rewrite session handler
              </div>
              <div className="text-[#8B949E] px-1">
                ======= Cursor: inline token verification
              </div>
              <div className="text-[#DA7756] bg-[#DA7756]/10 px-1 py-0.5 rounded">
                &gt;&gt;&gt;&gt;&gt;&gt;&gt; git merge: 2 files damaged
              </div>
            </div>
          </div>
        </div>

        {/* Column 02: The Solution */}
        <div className="rounded-lg bg-[#12161C] border border-[#3ECF8E]/40 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#3ECF8E]">
                02 // The Solution
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-[var(--font-display)] font-bold text-[#F0F3F6] tracking-tight">
              A single coordination layer for every agent.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#8B949E] leading-relaxed">
              Latch adds a distributed state layer with write mutexes, dependency blast-radius awareness, and sub-millisecond patch broadcasting.
            </p>

            {/* 4 Solution Feature Cards */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded bg-[#0B0E11] border border-[#262C34]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F3F6] mb-1">
                  <Shield className="w-3.5 h-3.5 text-[#3ECF8E]" />
                  Smart File Locks
                </div>
                <p className="text-[11px] text-[#8B949E] leading-relaxed">
                  Exclusive write claims enforced before any edit touches disk.
                </p>
              </div>

              <div className="p-3 rounded bg-[#0B0E11] border border-[#262C34]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F3F6] mb-1">
                  <Network className="w-3.5 h-3.5 text-[#3ECF8E]" />
                  Dependency Graph
                </div>
                <p className="text-[11px] text-[#8B949E] leading-relaxed">
                  Understands AST symbol imports and blocks contested blast radiuses.
                </p>
              </div>

              <div className="p-3 rounded bg-[#0B0E11] border border-[#262C34]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F3F6] mb-1">
                  <Eye className="w-3.5 h-3.5 text-[#3ECF8E]" />
                  Realtime Awareness
                </div>
                <p className="text-[11px] text-[#8B949E] leading-relaxed">
                  Agents see peer intentions, active leases, and tasks dynamically.
                </p>
              </div>

              <div className="p-3 rounded bg-[#0B0E11] border border-[#262C34]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F3F6] mb-1">
                  <GitPullRequest className="w-3.5 h-3.5 text-[#3ECF8E]" />
                  Causal Patch Sync
                </div>
                <p className="text-[11px] text-[#8B949E] leading-relaxed">
                  Propagates disk patches across all machines via Lamport clocks.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#262C34] flex items-center justify-between text-xs">
            <span className="text-[#3ECF8E] font-medium flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              100% Collision-free parallel autonomy
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
