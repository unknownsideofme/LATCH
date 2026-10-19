"use client";

import * as React from "react";
import Image from "next/image";
import { OrbitTimeline, type OrbitTimelineYear } from "@/components/ui/orbit-timeline";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";

const AI_AGENTS_ORBIT_DATA: OrbitTimelineYear[] = [
  {
    year: "2021",
    events: [
      {
        date: "Jun",
        icon: <img src="/agents/copilot.png" alt="GitHub Copilot" />,
        title: "GitHub Copilot (Codex)",
        description:
          "The first widespread coding assistant. Inline autocomplete transforms developer workflows, suggesting functions line by line.",
      },
    ],
  },
  {
    year: "2023",
    events: [
      {
        date: "Mar",
        icon: <img src="/agents/codex.png" alt="Codex CLI" />,
        title: "Codex CLI & Autonomous Loops",
        description:
          "AI moves beyond autocomplete into autonomous task execution, shell script generation, and terminal tool calls.",
      },
    ],
  },
  {
    year: "2024",
    events: [
      {
        date: "Jun",
        icon: <img src="/agents/cursor.png" alt="Cursor IDE" />,
        title: "Cursor IDE Revolution",
        description:
          "Cursor transforms VS Code into an agentic IDE with full repository indexing, multi-file diff generation, and inline debugging.",
      },
      {
        date: "Oct",
        icon: <img src="/agents/claude.png" alt="Claude Code" />,
        title: "Claude 3.5 Sonnet & Computer Use",
        description:
          "Anthropic releases Claude 3.5 Sonnet with Computer Use and terminal capabilities, enabling full-stack autonomous refactors.",
      },
    ],
  },
  {
    year: "2025",
    events: [
      {
        date: "May",
        icon: <img src="/agents/antigravity.png" alt="Antigravity Swarms" />,
        title: "Autonomous Multi-Agent Swarms",
        description:
          "Developers begin running multiple agents in parallel. Without coordination, concurrent writes cause severe file overwrites.",
      },
    ],
  },
  {
    year: "2026",
    events: [
      {
        date: "Now",
        icon: <img src="/logo.png" alt="Latch Protocol" />,
        title: "Latch — Multi-Agent Coordination",
        description:
          "The missing protocol for parallel AI coders: distributed AST file locks, causal Lamport clocks, and 0ms collision prevention.",
      },
    ],
  },
];

export function AiEvolutionOrbit() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mounted && resolvedTheme === "light";

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-14">
      {/* 2-Column Split: Text on Left, Orbit Figure on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Context & Chronology Narrative */}
        <div className="lg:col-span-5 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted border border-border text-[11px] font-mono text-primary">
            <span>CHRONOLOGY</span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1">
              <span>2021</span>
              <ArrowRight className="w-2.5 h-2.5" />
              <span>2026</span>
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-[var(--font-display)] font-bold text-foreground tracking-tight leading-snug">
            The Evolution of <br />
            <span className="text-primary">Autonomous Coding Agents</span>
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-[var(--font-body)]">
            Over five years, AI coding evolved from inline autocomplete into autonomous multi-agent teams. Each orbit represents the emergence of major AI agents.
          </p>

          <div className="space-y-2.5 pt-2 font-mono text-xs text-foreground">
            <div className="flex items-start gap-2.5 p-2.5 rounded bg-card border border-border shadow-sm">
              <span className="text-primary font-bold text-[11px] shrink-0 mt-0.5">2021</span>
              <div>
                <span className="text-xs font-semibold block text-foreground">GitHub Copilot</span>
                <span className="text-[11px] text-muted-foreground">Inline tab autocomplete</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded bg-card border border-border shadow-sm">
              <span className="text-primary font-bold text-[11px] shrink-0 mt-0.5">2024</span>
              <div>
                <span className="text-xs font-semibold block text-foreground">Cursor & Claude Code</span>
                <span className="text-[11px] text-muted-foreground">Autonomous multi-file repository editing</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded bg-card border border-primary/40 shadow-sm">
              <span className="text-primary font-bold text-[11px] shrink-0 mt-0.5">2026</span>
              <div>
                <span className="text-xs font-semibold block text-primary font-bold">Latch Coordination Engine</span>
                <span className="text-[11px] text-muted-foreground">P2P file locks & collision-free agent swarms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Compact Orbit Timeline with Agent Images */}
        <div className="lg:col-span-7">
          <div className="relative w-full h-[360px] sm:h-[420px] bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            {/* Interactive Orbit Timeline dynamically adopting light or dark */}
            <OrbitTimeline
              data={AI_AGENTS_ORBIT_DATA}
              theme={isLight ? "light" : "dark"}
              speed={0.65}
              direction="same"
              showYears={true}
              style={{ position: "absolute", inset: 0, minHeight: 0 }}
            />

            {/* Subtle helpful hint */}
            <div className="absolute bottom-2.5 right-3 text-[10px] font-mono text-muted-foreground pointer-events-none select-none">
              Click an agent badge to inspect
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
