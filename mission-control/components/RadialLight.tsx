"use client";

import React from "react";

export interface RadialLightProps {
  color?: "green" | "brown" | "red";
  position?: "left" | "right" | "center";
  className?: string;
}

/*
 * Pre-baked soft gradients — no filter:blur() needed.
 * The gradient stops are wide and feathered to produce the same visual
 * softness without triggering expensive GPU blur compositing.
 */
const PALETTES = {
  green: {
    outer:
      "radial-gradient(ellipse 70% 60% at 50% 48%, rgba(55,160,115,0.20) 0%, rgba(28,90,65,0.10) 30%, rgba(14,45,32,0.03) 55%, transparent 75%)",
    inner:
      "radial-gradient(ellipse 65% 55% at 52% 46%, rgba(85,200,148,0.32) 0%, rgba(52,150,108,0.16) 25%, rgba(25,85,60,0.06) 50%, transparent 72%)",
  },
  brown: {
    outer:
      "radial-gradient(ellipse 70% 60% at 50% 48%, rgba(150,105,80,0.22) 0%, rgba(100,74,64,0.11) 30%, rgba(55,38,30,0.03) 55%, transparent 75%)",
    inner:
      "radial-gradient(ellipse 65% 55% at 52% 46%, rgba(195,135,100,0.32) 0%, rgba(145,95,72,0.17) 25%, rgba(90,55,40,0.06) 50%, transparent 72%)",
  },
  red: {
    outer:
      "radial-gradient(ellipse 70% 60% at 50% 48%, rgba(229,77,46,0.20) 0%, rgba(160,45,30,0.10) 30%, rgba(80,20,15,0.03) 55%, transparent 75%)",
    inner:
      "radial-gradient(ellipse 65% 55% at 52% 46%, rgba(245,95,65,0.30) 0%, rgba(200,60,40,0.16) 25%, rgba(120,32,22,0.05) 50%, transparent 72%)",
  },
} as const;

export function RadialLight({
  color = "green",
  position = "center",
  className = "",
}: RadialLightProps) {
  const palette = PALETTES[color];

  return (
    <div
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
      style={{ contain: "strict" }}
    >
      {/*
        OUTER AURA — single element, pre-feathered gradient, zero blur filter.
      */}
      <div
        className="absolute top-[200px] sm:top-[260px] md:top-[300px] left-1/2 -translate-x-1/2 pointer-events-none"
      >
        <div
          className="radial-aura-outer w-[1800px] sm:w-[2200px] md:w-[2800px] h-[1300px] sm:h-[1600px] md:h-[1950px] pointer-events-none"
          style={{
            background: palette.outer,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      {/*
        INNER CORE — single element, pre-feathered gradient, zero blur filter.
      */}
      <div
        className="absolute top-[200px] sm:top-[260px] md:top-[300px] left-1/2 -translate-x-1/2 pointer-events-none"
      >
        <div
          className="radial-aura-inner w-[1050px] sm:w-[1350px] md:w-[1650px] h-[750px] sm:h-[980px] md:h-[1200px] pointer-events-none"
          style={{
            background: palette.inner,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <style jsx>{`
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
