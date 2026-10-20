"use client";

import { useRef } from "react";
import Image from "next/image";
import { AnimatedBeam } from "@/components/ui/klyv-animated-beam";
import { Cpu, Server, FileCode, Shield, Check, GitCommit, Layers } from "lucide-react";

export function ArchitectureFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Left Column Agents
  const claudeRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const copilotRef = useRef<HTMLDivElement>(null);

  // Center Orchestration Hub (Latch Daemon)
  const daemonRef = useRef<HTMLDivElement>(null);

  // Right Column Targets
  const mutexLockRef = useRef<HTMLDivElement>(null);
  const astGraphRef = useRef<HTMLDivElement>(null);
  const causalBusRef = useRef<HTMLDivElement>(null);

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-primary">
          03 // System Architecture Flow
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-[var(--font-display)] font-bold text-foreground mt-1 tracking-tight">
          How Latch Orchestrates The Swarm
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground font-[var(--font-body)]">
          Autonomous agents connect to the local Latch daemon. Write intentions are checked in sub-milliseconds against AST dependency graphs before any code hits disk.
        </p>
      </div>

      {/* Interactive Beam Network Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl bg-card border border-border p-6 sm:p-8 md:p-10 shadow-sm text-card-foreground"
      >
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center">
          
          {/* Column 1: AI Agents */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border mb-1">
              <Cpu className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                1. Concurrent AI Agents
              </span>
            </div>

            {/* Claude Code */}
            <div
              ref={claudeRef}
              className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-ring transition-all"
            >
              <div className="w-8 h-8 rounded-md relative p-1 bg-muted border border-border shrink-0 flex items-center justify-center">
                <Image
                  src="/agents/claude.png"
                  alt="Claude Code"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">Claude Code</h4>
                  <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">
                    CLI
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  Editing session token engine
                </p>
              </div>
            </div>

            {/* Cursor IDE */}
            <div
              ref={cursorRef}
              className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-ring transition-all"
            >
              <div className="w-8 h-8 rounded-md relative p-1 bg-muted border border-border shrink-0 flex items-center justify-center">
                <Image
                  src="/agents/cursor.png"
                  alt="Cursor IDE"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">Cursor IDE</h4>
                  <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">
                    IDE
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  Refactoring auth API endpoints
                </p>
              </div>
            </div>

            {/* Copilot / Codex */}
            <div
              ref={copilotRef}
              className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-ring transition-all"
            >
              <div className="w-8 h-8 rounded-md relative p-1 bg-muted border border-border shrink-0 flex items-center justify-center">
                <Image
                  src="/agents/copilot.png"
                  alt="Copilot CLI"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">Copilot & Codex</h4>
                  <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">
                    AGENT
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  Generating AST unit tests
                </p>
              </div>
            </div>
          </div>

          {/* Column 2: Center LATCH Hub */}
          <div className="flex flex-col items-center justify-center text-center">
            <div
              ref={daemonRef}
              className="relative p-6 rounded-2xl bg-background border-2 border-primary/40 shadow-sm max-w-[240px] w-full"
            >
              <div className="w-12 h-12 rounded-xl bg-card border border-primary/40 mx-auto flex items-center justify-center text-primary mb-3 mt-1 shadow-inner">
                <Server className="w-6 h-6" />
              </div>

              <h3 className="text-sm font-bold font-[var(--font-display)] text-foreground">
                Latch Core Daemon
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono mt-1 leading-normal">
                Local Mutex Engine & Causal Arbiter
              </p>

              <div className="mt-3.5 pt-3 border-t border-border">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted border border-border text-[10px] font-mono text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span>Port 3001 Socket</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Protected Resources & Primitives */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border mb-1">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                2. Coordination Primitives
              </span>
            </div>

            {/* Exclusive Mutex Lease */}
            <div
              ref={mutexLockRef}
              className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-ring transition-all"
            >
              <div className="w-8 h-8 rounded-md bg-muted border border-border shrink-0 flex items-center justify-center text-primary">
                <FileCode className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">Exclusive File Mutex</h4>
                  <span className="text-[9px] font-mono text-primary bg-primary/10 px-1 py-0.2 rounded font-bold">
                    0ms
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  Auto-expiring heartbeat lease
                </p>
              </div>
            </div>

            {/* AST Blast Radius Checker */}
            <div
              ref={astGraphRef}
              className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-ring transition-all"
            >
              <div className="w-8 h-8 rounded-md bg-muted border border-border shrink-0 flex items-center justify-center text-primary">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">AST Blast Radius</h4>
                  <span className="text-[9px] font-mono text-primary bg-primary/10 px-1 py-0.2 rounded font-bold">
                    TREE
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  Tree-sitter module boundary lock
                </p>
              </div>
            </div>

            {/* Causal Vector Clock Bus */}
            <div
              ref={causalBusRef}
              className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-ring transition-all"
            >
              <div className="w-8 h-8 rounded-md bg-muted border border-border shrink-0 flex items-center justify-center text-primary">
                <GitCommit className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">Causal Patch Bus</h4>
                  <span className="text-[9px] font-mono text-primary bg-primary/10 px-1 py-0.2 rounded font-bold">
                    SYNC
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  Lamport ordered live disk patch
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Animated Beams: Connecting Agents to Core Daemon */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={claudeRef}
          toRef={daemonRef}
          curvature={-30}
          duration={3.2}
          beamColor="var(--primary)"
          pathColor="var(--border)"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={cursorRef}
          toRef={daemonRef}
          curvature={0}
          duration={2.6}
          beamColor="var(--primary)"
          pathColor="var(--border)"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={copilotRef}
          toRef={daemonRef}
          curvature={30}
          duration={3.8}
          beamColor="var(--primary)"
          pathColor="var(--border)"
        />

        {/* Animated Beams: Connecting Core Daemon to Output Primitives */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={daemonRef}
          toRef={mutexLockRef}
          curvature={-30}
          duration={3.0}
          beamColor="var(--primary)"
          pathColor="var(--border)"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={daemonRef}
          toRef={astGraphRef}
          curvature={0}
          duration={2.5}
          beamColor="var(--primary)"
          pathColor="var(--border)"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={daemonRef}
          toRef={causalBusRef}
          curvature={30}
          duration={3.4}
          beamColor="var(--primary)"
          pathColor="var(--border)"
        />
      </div>
    </section>
  );
}
