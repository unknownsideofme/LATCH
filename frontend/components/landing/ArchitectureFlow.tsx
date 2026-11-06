"use client";

import { useRef } from "react";
import Image from "next/image";
import { AnimatedBeam } from "@/components/ui/klyv-animated-beam";
import {
  IconAgentSwarm,
  IconCoordinationShield,
  IconMutexLock,
  IconAstTree,
  IconCausalBus,
} from "@/components/icons/LatchIcons";

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
    <section className="w-full max-w-[94rem] mx-auto px-4 sm:px-6 lg:px-8 pt-0 sm:pt-2 pb-14 md:pb-20">
      {/* Section Header: Shifted upward closer to divider with prominent scale */}
      <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
          03 // System Architecture Flow
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-[2.65rem] font-[var(--font-display)] font-bold text-foreground mt-2 tracking-tight leading-tight">
          How Latch Orchestrates The Swarm
        </h2>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground font-[var(--font-body)] leading-relaxed max-w-2xl mx-auto">
          Autonomous agents connect to the local Latch daemon. Write intentions are checked in sub-milliseconds against AST dependency graphs before any code hits disk.
        </p>
      </div>

      {/* Interactive Beam Network Canvas: Scaled ~1.25x larger with expanded breadth, padding & cards */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl bg-card border border-border p-7 sm:p-10 md:p-14 lg:p-16 shadow-sm text-card-foreground min-h-[480px] md:min-h-[540px]"
      >
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-14 lg:gap-20 items-center">
          
          {/* Column 1: AI Agents (1.25x scaled cards) */}
          <div className="flex flex-col gap-4 sm:gap-4.5">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-border mb-1">
              <IconAgentSwarm className="w-4.5 h-4.5 text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                1. Concurrent AI Agents
              </span>
            </div>

            {/* Claude Code */}
            <div
              ref={claudeRef}
              className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-background border border-border hover:border-ring transition-all shadow-xs"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg relative p-1 bg-muted border border-border shrink-0 flex items-center justify-center">
                <Image
                  src="/agents/claude.png"
                  alt="Claude Code"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm sm:text-[15px] font-semibold text-foreground">Claude Code</h4>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded font-bold">
                    CLI
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                  Editing session token engine
                </p>
              </div>
            </div>

            {/* Cursor IDE */}
            <div
              ref={cursorRef}
              className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-background border border-border hover:border-ring transition-all shadow-xs"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg relative p-1 bg-muted border border-border shrink-0 flex items-center justify-center">
                <Image
                  src="/agents/cursor.png"
                  alt="Cursor IDE"
                  width={28}
                  height={28}
                  className="object-contain invert dark:invert-0"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm sm:text-[15px] font-semibold text-foreground">Cursor IDE</h4>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded font-bold">
                    IDE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                  Refactoring auth API endpoints
                </p>
              </div>
            </div>

            {/* Copilot / Codex */}
            <div
              ref={copilotRef}
              className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-background border border-border hover:border-ring transition-all shadow-xs"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg relative p-1 bg-muted border border-border shrink-0 flex items-center justify-center">
                <Image
                  src="/agents/copilot.png"
                  alt="Copilot CLI"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm sm:text-[15px] font-semibold text-foreground">Copilot &amp; Codex</h4>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded font-bold">
                    AGENT
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                  Generating AST unit tests
                </p>
              </div>
            </div>
          </div>

          {/* Column 2: Center LATCH Hub (1.3x expanded hub) */}
          <div className="flex flex-col items-center justify-center text-center">
            <div
              ref={daemonRef}
              className="relative p-7 sm:p-9 md:p-10 rounded-2xl bg-background border-2 border-primary/50 shadow-md max-w-[280px] sm:max-w-[310px] md:max-w-[330px] w-full"
            >
              <div className="w-20 h-16 sm:w-24 sm:h-18 rounded-2xl bg-card border border-primary/40 mx-auto flex items-center justify-center px-3 mb-4 mt-1 shadow-inner group">
                <Image
                  src="/latch-logo.png"
                  alt="Latch Core Daemon"
                  width={90}
                  height={24}
                  className="h-6 sm:h-7 w-auto object-contain dark:invert transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              <h3 className="text-base sm:text-lg md:text-xl font-bold font-[var(--font-display)] text-foreground">
                Latch Core Daemon
              </h3>
              <p className="text-xs sm:text-[13px] text-muted-foreground font-mono mt-1.5 leading-relaxed">
                Local Mutex Engine &amp; Causal Arbiter
              </p>

              <div className="mt-5 pt-4 border-t border-border">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-muted border border-border text-xs font-mono text-muted-foreground font-medium">
                  <span>Port 3001 Socket</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Protected Resources & Primitives (1.25x scaled cards) */}
          <div className="flex flex-col gap-4 sm:gap-4.5">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-border mb-1">
              <IconCoordinationShield className="w-4.5 h-4.5 text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                2. Coordination Primitives
              </span>
            </div>

            {/* Exclusive Mutex Lease */}
            <div
              ref={mutexLockRef}
              className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-background border border-border hover:border-ring transition-all shadow-xs"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-muted border border-border shrink-0 flex items-center justify-center text-primary">
                <IconMutexLock className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm sm:text-[15px] font-semibold text-foreground">Exclusive File Mutex</h4>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded font-bold">
                    0ms
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                  Auto-expiring heartbeat lease
                </p>
              </div>
            </div>

            {/* AST Blast Radius Checker */}
            <div
              ref={astGraphRef}
              className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-background border border-border hover:border-ring transition-all shadow-xs"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-muted border border-border shrink-0 flex items-center justify-center text-primary">
                <IconAstTree className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm sm:text-[15px] font-semibold text-foreground">AST Blast Radius</h4>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded font-bold">
                    TREE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                  Tree-sitter module boundary lock
                </p>
              </div>
            </div>

            {/* Causal Vector Clock Bus */}
            <div
              ref={causalBusRef}
              className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-background border border-border hover:border-ring transition-all shadow-xs"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-muted border border-border shrink-0 flex items-center justify-center text-primary">
                <IconCausalBus className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm sm:text-[15px] font-semibold text-foreground">Causal Patch Bus</h4>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded font-bold">
                    SYNC
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
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
          curvature={-35}
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
          curvature={35}
          duration={3.8}
          beamColor="var(--primary)"
          pathColor="var(--border)"
        />

        {/* Animated Beams: Connecting Core Daemon to Output Primitives */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={daemonRef}
          toRef={mutexLockRef}
          curvature={-35}
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
          curvature={35}
          duration={3.4}
          beamColor="var(--primary)"
          pathColor="var(--border)"
        />
      </div>
    </section>
  );
}
