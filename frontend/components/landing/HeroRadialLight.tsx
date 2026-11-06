"use client";

import { useEffect, useState } from "react";

export interface HeroRadialLightProps {
  colorMode?: "green" | "red" | "brown" | "auto";
  position?: "left" | "right" | "center" | "auto";
  topClass?: string;
  className?: string;
}

export function HeroRadialLight({
  colorMode: propColorMode = "auto",
  position = "auto",
  topClass,
  className = "",
}: HeroRadialLightProps = {}) {
  const [colorMode, setColorMode] = useState<"green" | "red" | "brown">(
    propColorMode === "auto" ? "green" : propColorMode
  );

  useEffect(() => {
    if (propColorMode !== "auto") {
      setColorMode(propColorMode);
      return;
    }

    let cachedPsTop = 800;
    let cachedArchTop = 1800;
    let cachedWindowH = typeof window !== "undefined" ? window.innerHeight : 900;

    // Cache layout offsets to eliminate layout thrashing during scroll
    const measureLayout = () => {
      cachedWindowH = window.innerHeight;
      const psEl = document.getElementById("problem-solution");
      const archEl = document.getElementById("features");
      if (psEl) cachedPsTop = psEl.offsetTop;
      if (archEl) cachedArchTop = archEl.offsetTop;
    };

    measureLayout();

    let ticking = false;
    let currentColor = "green";

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const psTop = cachedPsTop - cachedWindowH * 0.45;
          const archTop = cachedArchTop - cachedWindowH * 0.55;

          let newMode: "green" | "red" | "brown" = "green";
          if (scrollY >= archTop) {
            newMode = "brown";
          } else if (scrollY >= psTop) {
            newMode = "red";
          }

          if (newMode !== currentColor) {
            currentColor = newMode;
            setColorMode(newMode);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleResize = () => {
      measureLayout();
      handleScroll();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [propColorMode]);

  const isLeft = position === "left" || (position === "auto" && colorMode === "brown");
  const isCenter = position === "center";

  const outerTransformClass = isCenter
    ? "translate-x-0"
    : isLeft
    ? "-translate-x-[240px] sm:-translate-x-[310px] md:-translate-x-[360px]"
    : "translate-x-[240px] sm:translate-x-[310px] md:translate-x-[360px]";

  const innerTransformClass = isCenter
    ? "translate-x-0"
    : isLeft
    ? "-translate-x-[230px] sm:-translate-x-[290px] md:-translate-x-[340px]"
    : "translate-x-[230px] sm:translate-x-[290px] md:translate-x-[340px]";

  const finalTopClass = topClass || "top-[240px] sm:top-[280px] md:top-[320px]";

  return (
    <div
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
      style={{ contain: "strict" }}
    >
      {/* 
        ============================================================
        OUTER AURA ANCHOR (Large expansive radius: up to 2300px)
        Hardware-accelerated smooth CSS transition from right to left
        ============================================================
      */}
      <div
        className={`absolute ${finalTopClass} left-1/2 pointer-events-none transition-transform duration-1000 ease-in-out ${outerTransformClass}`}
        style={{ willChange: "transform" }}
      >
        {/* Green Outer Layer */}
        <div
          className={`absolute left-0 top-0 w-[1450px] sm:w-[1850px] md:w-[2300px] h-[1050px] sm:h-[1350px] md:h-[1620px] pointer-events-none aura-outer transition-opacity duration-1000 ease-out ${
            colorMode === "green" ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 50% 48%, rgba(55, 160, 115, 0.20) 0%, rgba(28, 90, 65, 0.11) 38%, rgba(14, 45, 32, 0.03) 65%, rgba(0, 0, 0, 0) 82%)",
            filter: "blur(50px)",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Red Outer Layer */}
        <div
          className={`absolute left-0 top-0 w-[1450px] sm:w-[1850px] md:w-[2300px] h-[1050px] sm:h-[1350px] md:h-[1620px] pointer-events-none aura-outer transition-opacity duration-1000 ease-out ${
            colorMode === "red" ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 50% 48%, rgba(229, 77, 46, 0.22) 0%, rgba(160, 45, 30, 0.12) 38%, rgba(80, 20, 15, 0.03) 65%, rgba(0, 0, 0, 0) 82%)",
            filter: "blur(50px)",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Brown Outer Layer */}
        <div
          className={`absolute left-0 top-0 w-[1450px] sm:w-[1850px] md:w-[2300px] h-[1050px] sm:h-[1350px] md:h-[1620px] pointer-events-none aura-outer transition-opacity duration-1000 ease-out ${
            colorMode === "brown" ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 50% 48%, rgba(150, 105, 80, 0.24) 0%, rgba(100, 74, 64, 0.13) 38%, rgba(55, 38, 30, 0.04) 65%, rgba(0, 0, 0, 0) 82%)",
            filter: "blur(50px)",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      {/* 
        ============================================================
        INNER CORE ANCHOR (Large core radius: up to 1360px)
        Hardware-accelerated smooth CSS transition from right to left
        ============================================================
      */}
      <div
        className={`absolute ${finalTopClass} left-1/2 pointer-events-none transition-transform duration-1000 ease-in-out ${innerTransformClass}`}
        style={{ willChange: "transform" }}
      >
        {/* Green Inner Core */}
        <div
          className={`absolute left-0 top-0 w-[820px] sm:w-[1100px] md:w-[1360px] h-[600px] sm:h-[800px] md:h-[990px] pointer-events-none aura-inner transition-opacity duration-1000 ease-out ${
            colorMode === "green" ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 52% 46%, rgba(85, 200, 148, 0.32) 0%, rgba(52, 150, 108, 0.20) 30%, rgba(25, 85, 60, 0.08) 58%, rgba(10, 35, 24, 0) 78%)",
            filter: "blur(35px)",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Red Inner Core */}
        <div
          className={`absolute left-0 top-0 w-[820px] sm:w-[1100px] md:w-[1360px] h-[600px] sm:h-[800px] md:h-[990px] pointer-events-none aura-inner transition-opacity duration-1000 ease-out ${
            colorMode === "red" ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 52% 46%, rgba(245, 95, 65, 0.35) 0%, rgba(200, 60, 40, 0.22) 30%, rgba(120, 32, 22, 0.09) 58%, rgba(40, 10, 8, 0) 78%)",
            filter: "blur(35px)",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Brown Inner Core */}
        <div
          className={`absolute left-0 top-0 w-[820px] sm:w-[1100px] md:w-[1360px] h-[600px] sm:h-[800px] md:h-[990px] pointer-events-none aura-inner transition-opacity duration-1000 ease-out ${
            colorMode === "brown" ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 52% 46%, rgba(195, 135, 100, 0.36) 0%, rgba(145, 95, 72, 0.23) 30%, rgba(90, 55, 40, 0.10) 58%, rgba(45, 25, 18, 0) 78%)",
            filter: "blur(35px)",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <style jsx>{`
        /* Smooth GPU-only transform animations */
        .aura-outer {
          animation: morphOuter 18s ease-in-out infinite alternate;
          transform-origin: 50% 50%;
          will-change: transform;
        }

        .aura-inner {
          animation: morphInner 12s ease-in-out infinite alternate;
          transform-origin: 50% 50%;
          will-change: transform;
        }

        @keyframes morphOuter {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1, 0.85);
          }
          33% {
            transform: translate(-50%, -50%) rotate(28deg) scale(1.12, 0.82);
          }
          66% {
            transform: translate(-50%, -50%) rotate(-24deg) scale(0.92, 1.06);
          }
          100% {
            transform: translate(-50%, -50%) rotate(18deg) scale(1.06, 0.88);
          }
        }

        @keyframes morphInner {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1, 0.86);
          }
          50% {
            transform: translate(-50%, -50%) rotate(-32deg) scale(1.14, 0.80);
          }
          100% {
            transform: translate(-50%, -50%) rotate(26deg) scale(0.90, 1.10);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .aura-outer,
          .aura-inner {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
