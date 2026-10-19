"use client";

import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LoadingCurtain } from "@/components/landing/LoadingCurtain";
import { HeroProductVisual } from "@/components/landing/HeroProductVisual";
import { ProblemSolutionSplit } from "@/components/landing/ProblemSolutionSplit";
import { ArchitectureFlow } from "@/components/landing/ArchitectureFlow";
import { QuickStartTerminal } from "@/components/landing/QuickStartTerminal";
import { LiveActivityStream } from "@/components/landing/LiveActivityStream";
import { FourPillarsGrid } from "@/components/landing/FourPillarsGrid";
import { PricingTiers } from "@/components/landing/PricingTiers";
import { StatsMarquee } from "@/components/kinetic/StatsMarquee";
import { AgentMarquee } from "@/components/kinetic/AgentMarquee";
import { AiEvolutionOrbit } from "@/components/landing/AiEvolutionOrbit";
import { DecoButton } from "@/components/deco/DecoButton";
import { DecoDivider } from "@/components/deco/DecoDivider";
import { HalftoneWordmarkFooter } from "@/components/ui/halftone-wordmark-footer";
import { Sparkles, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function Home() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative transition-colors duration-200">
      {/* Intro transition */}
      <LoadingCurtain />

      {/* Header */}
      <LandingHeader />

      <main className="flex-1 pt-20 pb-16 relative">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 max-w-6xl mx-auto pt-10 md:pt-16 pb-8 text-center">
          <div className="flex flex-col items-center">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono font-medium text-primary">
                CROSS-AGENT COORDINATION LAYER
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-mono text-muted-foreground">
                ZERO OVERWRITES
              </span>
            </div>

            {/* Clean Hero Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-[var(--font-display)] font-extrabold text-foreground tracking-tight max-w-4xl leading-[1.15]">
              Build at Machine Speed. <br className="hidden sm:inline" />
              <span className="text-primary">Without File Collisions.</span>
            </h1>

            {/* Description */}
            <p className="mt-4 text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-[var(--font-body)]">
              Git coordinates humans committing minutes apart.{" "}
              <strong className="text-foreground font-medium">
                Latch coordinates autonomous AI agents editing the same files in real time
              </strong>{" "}
              — exclusive write locks, dependency blast radius checks, and live causal patch sync.
            </p>

            {/* Two Action Mechanisms: Free & Pro */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup?plan=free">
                <DecoButton variant="solid" size="lg">
                  <span className="inline-flex items-center gap-1.5">
                    <span>Start for Free</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </DecoButton>
              </Link>
              <Link href="/signup?plan=pro">
                <DecoButton
                  variant="outline"
                  size="lg"
                  icon={<Sparkles className="w-4 h-4 text-primary" />}
                >
                  Get Pro Access
                </DecoButton>
              </Link>
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Zero Cloud Lock-in
              </span>
              <span>·</span>
              <span>Local Daemon on Port 3001</span>
              <span>·</span>
              <span>Open Source Core</span>
            </div>

            {/* 3D Perspective Layered Product Visual */}
            <div className="mt-10 max-w-4xl mx-auto w-full text-left">
              <HeroProductVisual />
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <div className="my-6">
          <StatsMarquee />
        </div>

        {/* 01 The Problem vs 02 The Solution */}
        <ProblemSolutionSplit />

        {/* Live Activity Stream & Telemetry */}
        <section id="stream" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-mono font-medium uppercase tracking-wider text-primary">
              Live Protocol Simulation
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Socket: Active (0.8ms latency)
            </span>
          </div>
          <LiveActivityStream />
        </section>

        {/* Agent Marquee Strip */}
        <div className="my-6">
          <AgentMarquee />
        </div>

        {/* Divider */}
        <DecoDivider title="Evolution Timeline" />

        {/* Orbit Timeline: Evolution of AI */}
        <div id="evolution">
          <AiEvolutionOrbit />
        </div>

        {/* Divider */}
        <DecoDivider title="How It Works" />

        {/* 03 How It Works Architecture Flow */}
        <ArchitectureFlow />

        {/* Divider */}
        <DecoDivider title="System Architecture" />

        {/* Four Pillars Section */}
        <div id="features">
          <FourPillarsGrid />
        </div>

        {/* Quick Start Terminal */}
        <QuickStartTerminal />

        {/* Divider */}
        <DecoDivider title="Access Tiers" />

        {/* Pricing Tiers Section */}
        <div id="pricing">
          <PricingTiers />
        </div>

        {/* Interactive Halftone Wordmark Footer */}
        <div className="mt-20 border-t border-border">
          <HalftoneWordmarkFooter
            wordmark="latch"
            label="Latch Systems"
            meta="©2026 · Machine-Speed Coordination Layer"
            preset={isDark ? "night" : "paper"}
            crop={0}
            palette={
              isDark
                ? {
                    background: "#111111",
                    ink: "#eeeeee",
                    warm: "#ffe0c2",
                  }
                : {
                    background: "#f9f9f9",
                    ink: "#202020",
                    warm: "#644a40",
                  }
            }
            columns={[
              {
                title: "Protocol",
                links: [
                  { label: "Architecture", href: "#features" },
                  { label: "Telemetry Stream", href: "#stream" },
                  { label: "Agent Evolution", href: "#evolution" },
                ],
              },
              {
                title: "Product",
                links: [
                  { label: "Mission Control", href: "/dashboard" },
                  { label: "Cockpit Studio", href: "/dashboard" },
                  { label: "CLI Tool", href: "#get-started" },
                ],
              },
              {
                title: "Ecosystem",
                links: [
                  { label: "GitHub", href: "https://github.com/unknownsideofme/LATCH" },
                  { label: "Supabase Backend", href: "https://supabase.com" },
                  { label: "Sign In", href: "/login" },
                ],
              },
            ]}
            height="520px"
          />
        </div>
      </main>
    </div>
  );
}
