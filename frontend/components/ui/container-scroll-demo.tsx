"use client";

import React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { LatchCockpitDashboard } from "@/components/landing/LatchCockpitDashboard";

export function HeroScrollDemo() {
  return (
    <div className="flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-200">
      <ContainerScroll
        titleComponent={
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs font-mono text-primary mb-4 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              LATCH PROTOCOL · MULTI-AGENT SWARM SYNCHRONIZER
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold font-[var(--font-display)] tracking-tight text-foreground leading-tight">
              Unleash Machine Speed. <br />
              <span className="text-primary">
                Zero Git Overwrites.
              </span>
            </h2>
            <p className="mt-4 text-xs sm:text-sm md:text-base text-muted-foreground font-[var(--font-body)] max-w-2xl mx-auto leading-relaxed">
              Every write intercepted before hitting disk. Concrete Tree-sitter AST dependency boundaries,
              sub-millisecond exclusive mutex leases, and peer-to-peer patch streaming.
            </p>
          </div>
        }
      >
        <LatchCockpitDashboard />
      </ContainerScroll>
    </div>
  );
}

export default HeroScrollDemo;
