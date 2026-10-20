"use client";

import { X, Check, AlertOctagon, Shield, Network, Eye, GitPullRequest } from "lucide-react";

export function ProblemSolutionSplit() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 01: The Problem */}
        <div className="rounded-lg bg-card border border-border p-6 sm:p-8 flex flex-col justify-between text-card-foreground shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-destructive">
                01 // The Problem
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-[var(--font-display)] font-bold text-foreground tracking-tight">
              AI agents are fast. But they don't coordinate.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              When multiple agents edit the same repository in parallel, they overwrite each other's changes, hallucinate broken AST interfaces, and destroy work.
            </p>

            {/* Problem Checklist */}
            <div className="mt-6 space-y-2.5 text-xs text-foreground">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-center shrink-0">
                  <X className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
                <span>No filesystem lock coordination</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-center shrink-0">
                  <X className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
                <span>Zero awareness of other running agents</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-center shrink-0">
                  <X className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
                <span>Silent code clobbering & broken builds</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-center shrink-0">
                  <X className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
                <span>Designed for solo developers, not agent swarms</span>
              </div>
            </div>
          </div>

          {/* Merge Conflict Code Card Inset */}
          <div className="mt-6 p-3.5 rounded bg-muted/30 border border-destructive/40 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase mb-2">
              <AlertOctagon className="w-3.5 h-3.5" />
              Merge Conflict Detected (No Latch)
            </div>
            <div className="space-y-1 text-[11px] leading-relaxed">
              <div className="text-muted-foreground">// src/auth.ts · concurrent edits clobbered</div>
              <div className="text-destructive bg-destructive/10 px-1 py-0.5 rounded">
                &lt;&lt;&lt;&lt;&lt;&lt;&lt; Claude Code: rewrite session handler
              </div>
              <div className="text-muted-foreground px-1">
                ======= Cursor: inline token verification
              </div>
              <div className="text-destructive bg-destructive/10 px-1 py-0.5 rounded">
                &gt;&gt;&gt;&gt;&gt;&gt;&gt;
              </div>
            </div>
          </div>
        </div>

        {/* Column 02: The Solution */}
        <div className="rounded-lg bg-card border border-primary/30 p-6 sm:p-8 flex flex-col justify-between text-card-foreground shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-primary">
                02 // The Solution
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-[var(--font-display)] font-bold text-foreground tracking-tight">
              A real-time coordination layer for machine-speed coders.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Latch wraps your repository in a distributed AST lock engine and causal patch bus. Agents request locks before editing and synchronize AST boundaries.
            </p>

            {/* Solution Checklist */}
            <div className="mt-6 space-y-2.5 text-xs text-foreground">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
                <span>Sub-millisecond exclusive file mutex leases</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
                <span>AST dependency blast-radius bounding</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
                <span>Real-time causal patch streaming via vector clocks</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
                <span>Stop hook protocol integration for all major agents</span>
              </div>
            </div>
          </div>

          {/* Solution Spec Pill Matrix */}
          <div className="mt-6 grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-3 rounded bg-muted/40 border border-border">
              <div className="flex items-center gap-1.5 text-primary text-[10px] uppercase font-bold mb-1">
                <Shield className="w-3 h-3" />
                <span>File Mutex</span>
              </div>
              <div className="text-[11px] text-muted-foreground">0ms Overwrite Rate</div>
            </div>

            <div className="p-3 rounded bg-muted/40 border border-border">
              <div className="flex items-center gap-1.5 text-primary text-[10px] uppercase font-bold mb-1">
                <Network className="w-3 h-3" />
                <span>AST Blast</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Bounded Radius</div>
            </div>

            <div className="p-3 rounded bg-muted/40 border border-border">
              <div className="flex items-center gap-1.5 text-primary text-[10px] uppercase font-bold mb-1">
                <GitPullRequest className="w-3 h-3" />
                <span>Causal Clock</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Lamport Order</div>
            </div>

            <div className="p-3 rounded bg-muted/40 border border-border">
              <div className="flex items-center gap-1.5 text-primary text-[10px] uppercase font-bold mb-1">
                <Eye className="w-3 h-3" />
                <span>Zero Lock-in</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Local Daemon :3001</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
