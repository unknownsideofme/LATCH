"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";

export function LoadingCurtain() {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasSeenCurtain = sessionStorage.getItem("latch_intro_seen");
    if (hasSeenCurtain) {
      if (containerRef.current) containerRef.current.style.display = "none";
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        sessionStorage.setItem("latch_intro_seen", "true");
        if (containerRef.current) containerRef.current.style.display = "none";
      },
    });

    tl.fromTo(
      logoRef.current,
      { scale: 0.95, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.4, ease: "power2.out" }
    )
      .to(logoRef.current, {
        opacity: 0,
        scale: 1.02,
        duration: 0.2,
        delay: 0.25,
        ease: "power2.in",
      })
      .to(
        leftPanelRef.current,
        {
          xPercent: -100,
          duration: 0.5,
          ease: "power4.inOut",
        },
        "-=0.1"
      )
      .to(
        rightPanelRef.current,
        {
          xPercent: 100,
          duration: 0.5,
          ease: "power4.inOut",
        },
        "<"
      );
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 pointer-events-none flex"
      aria-hidden="true"
    >
      {/* Left panel */}
      <div
        ref={leftPanelRef}
        className="w-1/2 h-full bg-background border-r border-border flex items-center justify-end pr-6"
      />

      {/* Right panel */}
      <div
        ref={rightPanelRef}
        className="w-1/2 h-full bg-background border-l border-border flex items-center justify-start pl-6"
      />

      {/* Center wordmark */}
      <div
        ref={logoRef}
        className="absolute inset-0 flex flex-col items-center justify-center z-10 select-none"
      >
        <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center mb-3 shadow-md border border-border bg-card p-1">
          <Image
            src="/latch-logo.png"
            alt="Latch Logo"
            width={56}
            height={56}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-foreground">
          Latch
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-wider text-primary mt-1 font-semibold">
          Zero-Collision AI Swarm Engine
        </p>
      </div>
    </div>
  );
}
