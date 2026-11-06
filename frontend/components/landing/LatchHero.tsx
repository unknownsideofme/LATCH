"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AnimatedLatchLogo } from "@/components/landing/AnimatedLatchLogo";
import { DecoButton } from "@/components/deco/DecoButton";
import { IconArrowUpRight } from "@/components/icons/LatchIcons";
import { HeroRadialLight } from "@/components/landing/HeroRadialLight";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { LatchCockpitDashboard } from "./LatchCockpitDashboard";

export function LatchHero() {
  return (
    <section className="relative w-full flex flex-col items-center justify-start pt-14 sm:pt-16 md:pt-20 pb-0 sm:pb-8 md:pb-12 overflow-hidden bg-transparent text-foreground transition-colors">
      {/* Full-width Radial Light Atmosphere from Main branch */}
      <HeroRadialLight />

      {/* 3D Perspective Container Scroll Animation wrapping the dynamic Cockpit Screen */}
      <ContainerScroll
        titleComponent={
          <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-5 sm:pt-6 pb-0 sm:pb-4">
            {/* Laptop/Desktop Spacer matching main branch positioning */}
            <div className="w-full h-[clamp(32px,calc(24vh-4rem),24vh)] pointer-events-none hidden sm:block" aria-hidden="true" />

            {/* Blooming Flower Animated Logo with sequenced latch.it text reveal */}
            <div className="mb-3 sm:mb-4">
              <AnimatedLatchLogo size="hero" />
            </div>

            {/* Clean Hero Headline from Main Branch: Static, No animation, Library 3 AM font */}
            <h1 className="w-full font-library3am tracking-wide uppercase text-center leading-[1.12] select-none my-2 sm:my-3">
              <span className="block text-[clamp(2.1rem,6.6vw,5.2rem)] text-foreground whitespace-nowrap">
                Build at Machine Speed.
              </span>
              <span className="block text-[clamp(1.75rem,5.6vw,4.4rem)] text-primary whitespace-nowrap mt-1.5 sm:mt-2">
                ZERO Collision. ZERO Chaos.
              </span>
            </h1>

            {/* Description with Latch Logo from Main */}
            <p className="mt-3.5 sm:mt-4.5 mb-2 sm:mb-3 text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-[var(--font-body)]">
              Humans commit minutes apart.{" "}
              <strong className="text-foreground font-medium inline-flex items-center gap-1.5 flex-wrap justify-center align-middle">
                <Image
                  src="/latch-logo.png"
                  alt="Latch"
                  width={76}
                  height={18}
                  className="h-4.5 sm:h-5.5 w-auto inline-block object-contain dark:invert"
                />
                <span>coordinates autonomous AI agents editing the same files in real time</span>
              </strong>
            </p>

            {/* Two Action Mechanisms: Free & Pro from Main */}
            <div className="mt-5 sm:mt-6 mb-2 sm:mb-3 flex flex-wrap items-center justify-center gap-4">
              <Link href="/signup?plan=free">
                <DecoButton variant="solid" size="lg" className="px-6 py-2.5 sm:px-7 sm:py-3 text-sm sm:text-base">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span>Start for Free</span>
                    <IconArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                </DecoButton>
              </Link>
              <Link href="/signup?plan=pro">
                <DecoButton
                  variant="outline"
                  size="lg"
                  icon={<Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-primary" />}
                  className="px-6 py-2.5 sm:px-7 sm:py-3 text-sm sm:text-base font-semibold"
                >
                  Get Pro Access
                </DecoButton>
              </Link>
            </div>
          </div>
        }
      >
        {/* The dynamic real-time Cockpit Screen with 3D scroll physics */}
        <LatchCockpitDashboard />
      </ContainerScroll>
    </section>
  );
}
