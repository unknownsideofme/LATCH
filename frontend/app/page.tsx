"use client";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { LoadingCurtain } from "@/components/landing/LoadingCurtain";
import { LatchHero } from "@/components/landing/LatchHero";
import { ProblemSolutionSplit } from "@/components/landing/ProblemSolutionSplit";
import { ArchitectureFlow } from "@/components/landing/ArchitectureFlow";
import { DecoDivider } from "@/components/deco/DecoDivider";
import { HalftoneWordmarkFooter } from "@/components/ui/halftone-wordmark-footer";
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
      {/* Intro curtain transition */}
      <LoadingCurtain />

      {/* Header */}
      <LandingHeader />

      <main className="flex-1 relative z-10 overflow-x-clip">
        {/* Hero Section: Clean Typography, Logo, Theme + 3D Scroll Cockpit Screen */}
        <LatchHero />

        {/* 01 The Problem vs 02 The Solution */}
        <ProblemSolutionSplit />

        {/* Divider */}
        <DecoDivider title="System Architecture" />

        {/* 03 System Architecture Flow */}
        <div id="features">
          <ArchitectureFlow />
        </div>





        {/* Interactive Halftone Wordmark Footer */}
        <div className="border-t border-border">
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
                  { label: "Locks & Mutex", href: "#problem-solution" },
                ],
              },
              {
                title: "Product",
                links: [
                  { label: "Mission Control", href: "/dashboard" },
                  { label: "Cockpit Studio", href: "/dashboard" },
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
