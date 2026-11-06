"use client";

import { useEffect, useState, useMemo } from "react";

export interface HeroRadialLightProps {
  colorMode?: "green" | "red" | "brown" | "auto";
  position?: "left" | "right" | "center" | "auto";
  topClass?: string;
  className?: string;
}

/*
 * COLOR PALETTES — pre-baked soft radial gradients.
 * The gradient stops are wide and feathered so we never need filter:blur(),
 * which is the #1 GPU cost killer on low-end devices.
 */
const PALETTES = {
  green: {
    outer:
      "radial-gradient(ellipse 70% 60% at 50% 48%, rgba(55,160,115,0.18) 0%, rgba(28,90,65,0.09) 30%, rgba(14,45,32,0.03) 55%, transparent 75%)",
    inner:
      "radial-gradient(ellipse 65% 55% at 52% 46%, rgba(85,200,148,0.28) 0%, rgba(52,150,108,0.14) 25%, rgba(25,85,60,0.05) 50%, transparent 72%)",
  },
  red: {
    outer:
      "radial-gradient(ellipse 70% 60% at 50% 48%, rgba(229,77,46,0.20) 0%, rgba(160,45,30,0.10) 30%, rgba(80,20,15,0.03) 55%, transparent 75%)",
    inner:
      "radial-gradient(ellipse 65% 55% at 52% 46%, rgba(245,95,65,0.30) 0%, rgba(200,60,40,0.16) 25%, rgba(120,32,22,0.05) 50%, transparent 72%)",
  },
  brown: {
    outer:
      "radial-gradient(ellipse 70% 60% at 50% 48%, rgba(150,105,80,0.22) 0%, rgba(100,74,64,0.11) 30%, rgba(55,38,30,0.03) 55%, transparent 75%)",
    inner:
      "radial-gradient(ellipse 65% 55% at 52% 46%, rgba(195,135,100,0.32) 0%, rgba(145,95,72,0.17) 25%, rgba(90,55,40,0.06) 50%, transparent 72%)",
  },
} as const;

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

  const palette = PALETTES[colorMode];

  return (
    <div
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
      style={{ contain: "strict" }}
    >
      {/*
        OUTER AURA — single element, no blur filter.
        The gradient itself is pre-feathered to look naturally soft.
      */}
      <div
        className={`absolute ${finalTopClass} left-1/2 pointer-events-none transition-transform duration-1000 ease-in-out ${outerTransformClass}`}
      >
        <div
          className="radial-aura-outer w-[1800px] sm:w-[2200px] md:w-[2800px] h-[1300px] sm:h-[1600px] md:h-[1950px] pointer-events-none"
          style={{
            background: palette.outer,
            transform: "translate(-50%, -50%)",
            transition: "background 800ms ease-out",
          }}
        />
      </div>

      {/*
        INNER CORE — single element, no blur filter.
      */}
      <div
        className={`absolute ${finalTopClass} left-1/2 pointer-events-none transition-transform duration-1000 ease-in-out ${innerTransformClass}`}
      >
        <div
          className="radial-aura-inner w-[1050px] sm:w-[1350px] md:w-[1650px] h-[750px] sm:h-[980px] md:h-[1200px] pointer-events-none"
          style={{
            background: palette.inner,
            transform: "translate(-50%, -50%)",
            transition: "background 800ms ease-out",
          }}
        />
      </div>

      <style jsx>{`
        /*
         * Gentle organic morph — GPU composited transform only.
         * No filter, no box-shadow, no layer promotion beyond the two elements.
         */
        .radial-aura-outer {
          animation: morphOuter 20s ease-in-out infinite alternate;
          transform-origin: 50% 50%;
        }
        .radial-aura-inner {
          animation: morphInner 14s ease-in-out infinite alternate;
          transform-origin: 50% 50%;
        }

        @keyframes morphOuter {
          0%   { transform: translate(-50%, -50%) rotate(0deg) scale(1, 0.88); }
          50%  { transform: translate(-50%, -50%) rotate(15deg) scale(1.08, 0.84); }
          100% { transform: translate(-50%, -50%) rotate(-12deg) scale(0.95, 1.04); }
        }

        @keyframes morphInner {
          0%   { transform: translate(-50%, -50%) rotate(0deg) scale(1, 0.90); }
          50%  { transform: translate(-50%, -50%) rotate(-18deg) scale(1.10, 0.84); }
          100% { transform: translate(-50%, -50%) rotate(14deg) scale(0.92, 1.06); }
        }

        @media (prefers-reduced-motion: reduce) {
          .radial-aura-outer,
          .radial-aura-inner {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
