"use client";

import * as React from "react";
import Image from "next/image";
import { Lock, Shield, Cpu, Folder, FileText, CheckCircle2, GitBranch, Zap, Sparkles } from "lucide-react";
import { AnimatedBeam } from "@/components/ui/klyv-animated-beam";

export function ArchitectureFlow() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Left nodes: AI Agents
  const claudeRef = React.useRef<HTMLDivElement>(null);
  const cursorRef = React.useRef<HTMLDivElement>(null);
  const copilotRef = React.useRef<HTMLDivElement>(null);
  const codexRef = React.useRef<HTMLDivElement>(null);

  // Center node: Latch Hub (:3001)
  const hubRef = React.useRef<HTMLDivElement>(null);

  // Right nodes: Codebase & Coordination state
  const locksRef = React.useRef<HTMLDivElement>(null);
  const astRef = React.useRef<HTMLDivElement>(null);
  const syncRef = React.useRef<HTMLDivElement>(null);

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#262C34] mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] text-[11px] font-mono font-medium uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3" />
            03 // Live Coordination Flow
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-[var(--font-display)] font-bold text-[#F0F3F6] tracking-tight">
            Machine-Speed Multi-Agent Arbitration
          </h2>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-[#8B949E] font-[var(--font-body)]">
          Realtime pulses visualize how concurrent AI agents stream tool calls through Latch daemon (:3001) before acquiring locks or committing changes.
        </p>
      </div>

      {/* Interactive Beam Network Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl bg-[#0B0E11] border border-[#262C34] p-6 sm:p-8 md:p-10"
      >
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#F0F3F6 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center">
          
          {/* Column 1: AI Agents */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#262C34] mb-1">
              <Cpu className="w-4 h-4 text-[#3ECF8E]" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B949E] font-semibold">
                1. Concurrent AI Agents
              </span>
            </div>

            {/* Claude Code */}
            <div
              ref={claudeRef}
              className="group flex items-center justify-between p-2.5 rounded-lg bg-[#12161C] border border-[#262C34] hover:border-[#3ECF8E]/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded relative p-1 bg-[#161B22] border border-[#262C34] flex items-center justify-center">
                  <Image
                    src="/agents/claude.png"
                    alt="Claude Code"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#F0F3F6] block">Claude Code</span>
                  <span className="text-[10px] text-[#8B949E] font-mono">CLI Agent</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
            </div>

            {/* Cursor */}
            <div
              ref={cursorRef}
              className="group flex items-center justify-between p-2.5 rounded-lg bg-[#12161C] border border-[#262C34] hover:border-[#3ECF8E]/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded relative p-1 bg-[#161B22] border border-[#262C34] flex items-center justify-center">
                  <Image
                    src="/agents/cursor.png"
                    alt="Cursor"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#F0F3F6] block">Cursor IDE</span>
                  <span className="text-[10px] text-[#8B949E] font-mono">Editor Context</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#3ECF8E]" />
            </div>

            {/* Copilot */}
            <div
              ref={copilotRef}
              className="group flex items-center justify-between p-2.5 rounded-lg bg-[#12161C] border border-[#262C34] hover:border-[#3ECF8E]/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded relative p-1 bg-[#161B22] border border-[#262C34] flex items-center justify-center">
                  <Image
                    src="/agents/copilot.png"
                    alt="Copilot"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#F0F3F6] block">Copilot CLI</span>
                  <span className="text-[10px] text-[#8B949E] font-mono">Terminal Runner</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#3ECF8E]" />
            </div>

            {/* Codex */}
            <div
              ref={codexRef}
              className="group flex items-center justify-between p-2.5 rounded-lg bg-[#12161C] border border-[#262C34] hover:border-[#3ECF8E]/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded relative p-1 bg-[#161B22] border border-[#262C34] flex items-center justify-center">
                  <Image
                    src="/agents/codex.png"
                    alt="Codex"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#F0F3F6] block">Codex</span>
                  <span className="text-[10px] text-[#8B949E] font-mono">Background Sync</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#3ECF8E]/60" />
            </div>
          </div>

          {/* Column 2: Central Latch Engine */}
          <div className="flex flex-col items-center justify-center py-4">
            <div
              ref={hubRef}
              className="w-full max-w-xs rounded-xl bg-[#161B22] border-2 border-[#3ECF8E]/60 p-5 shadow-[0_0_30px_rgba(62,207,142,0.12)] text-center relative"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#3ECF8E] text-black text-[10px] font-mono font-bold tracking-wider uppercase">
                Daemon :3001
              </div>

              <div className="w-12 h-12 rounded-xl bg-[#0B0E11] border border-[#3ECF8E]/40 mx-auto flex items-center justify-center text-[#3ECF8E] mb-3 mt-1 shadow-inner">
                <span className="font-[var(--font-display)] font-extrabold text-xl">L</span>
              </div>

              <h3 className="font-[var(--font-display)] font-bold text-base text-[#F0F3F6] mb-1">
                Latch Hub Engine
              </h3>
              <p className="text-[11px] text-[#8B949E] font-mono mb-3">
                Zero-Latency Mutex Bus
              </p>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0B0E11] border border-[#262C34] text-[10px] font-mono text-[#3ECF8E]">
                <Zap className="w-3 h-3 text-[#3ECF8E]" />
                <span>Arbitrating 4 Streams</span>
              </div>
            </div>
          </div>

          {/* Column 3: Protected State & Graph */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#262C34] mb-1">
              <Folder className="w-4 h-4 text-[#3ECF8E]" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B949E] font-semibold">
                3. Synchronized State
              </span>
            </div>

            {/* Locks */}
            <div
              ref={locksRef}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#12161C] border border-[#262C34] hover:border-[#3ECF8E]/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-[#161B22] border border-[#262C34] flex items-center justify-center text-[#3ECF8E]">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#F0F3F6] block">File Mutex Locks</span>
                  <span className="text-[10px] text-[#8B949E] font-mono">src/auth.ts locked</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#3ECF8E]/20 text-[#3ECF8E]">
                LOCKED
              </span>
            </div>

            {/* AST Graph */}
            <div
              ref={astRef}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#12161C] border border-[#262C34] hover:border-[#3ECF8E]/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-[#161B22] border border-[#262C34] flex items-center justify-center text-[#3ECF8E]">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#F0F3F6] block">AST Blast Radius</span>
                  <span className="text-[10px] text-[#8B949E] font-mono">Cross-module safety</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#161B22] text-[#8B949E] border border-[#262C34]">
                SAFE
              </span>
            </div>

            {/* Git Sync */}
            <div
              ref={syncRef}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#12161C] border border-[#262C34] hover:border-[#3ECF8E]/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-[#161B22] border border-[#262C34] flex items-center justify-center text-[#3ECF8E]">
                  <GitBranch className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#F0F3F6] block">Causal Patch Sync</span>
                  <span className="text-[10px] text-[#8B949E] font-mono">Zero merge conflicts</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#3ECF8E]/10 text-[#3ECF8E]">
                SYNCED
              </span>
            </div>
          </div>
        </div>

        {/* Animated Beams: Left Column Agents -> Center Hub */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={claudeRef}
          toRef={hubRef}
          curvature={-38}
          duration={2.6}
          beamColor="#3ECF8E"
          pathColor="#262C34"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={cursorRef}
          toRef={hubRef}
          curvature={-14}
          duration={2.6}
          delay={0.4}
          beamColor="#3ECF8E"
          pathColor="#262C34"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={copilotRef}
          toRef={hubRef}
          curvature={14}
          duration={2.6}
          delay={0.8}
          beamColor="#3ECF8E"
          pathColor="#262C34"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={codexRef}
          toRef={hubRef}
          curvature={38}
          duration={2.6}
          delay={1.2}
          beamColor="#3ECF8E"
          pathColor="#262C34"
        />

        {/* Animated Beams: Center Hub -> Right Column Targets */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={hubRef}
          toRef={locksRef}
          curvature={-24}
          duration={2.2}
          delay={0.6}
          beamColor="#3ECF8E"
          pathColor="#262C34"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={hubRef}
          toRef={astRef}
          curvature={0}
          duration={2.2}
          delay={1.0}
          beamColor="#3ECF8E"
          pathColor="#262C34"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={hubRef}
          toRef={syncRef}
          curvature={24}
          duration={2.2}
          delay={1.4}
          beamColor="#3ECF8E"
          pathColor="#262C34"
        />
      </div>
    </section>
  );
}
