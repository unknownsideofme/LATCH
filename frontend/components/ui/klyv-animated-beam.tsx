/*
MIT License

Copyright (c) 2026 Klyv contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
"use client";

import "./klyv-animated-beam-utils/klyv-theme.css";
import { useEffect, useId, useState, type CSSProperties, type RefObject } from "react";
import { cn } from "./klyv-animated-beam-utils/lib-cn";

export interface AnimatedBeamProps {
  /** The positioned element both endpoints live inside. */
  containerRef: RefObject<HTMLElement | null>;
  /** The element the beam starts at. */
  fromRef: RefObject<HTMLElement | null>;
  /** The element the beam ends at. */
  toRef: RefObject<HTMLElement | null>;
  /** Bow of the curve in pixels. Negative bows the other way. 0 is a straight line. */
  curvature?: number;
  /** Send the pulse from `to` to `from` instead. */
  reverse?: boolean;
  /** Seconds for one pulse to cross. */
  duration?: number;
  /** Seconds before the first pulse. Stagger these across a diagram. */
  delay?: number;
  /** The dim track the pulse runs along. */
  pathColor?: string;
  /** Stroke width of the dim track underneath. */
  pathWidth?: number;
  /** Opacity of the dim track underneath. */
  pathOpacity?: number;
  /** Any CSS colour for the travelling pulse. */
  beamColor?: string;
  /** Length of the lit pulse in pixels. */
  beamLength?: number;
  /** Draw the track but hold the pulse still. */
  paused?: boolean;
  /** Merged last, so it wins. */
  className?: string;
}

interface Geometry {
  width: number;
  height: number;
  d: string;
  length: number;
}

/** Centre of `node` in `container` coordinates. */
function centreIn(container: DOMRect, node: DOMRect) {
  return {
    x: node.left - container.left + node.width / 2,
    y: node.top - container.top + node.height / 2,
  };
}

/**
 * A curved connector between two elements, with light pulsing along it.
 *
 * It takes refs rather than coordinates because the whole point is that the
 * endpoints are real, reflowing UI: the beam re-measures on resize and on any
 * size change to the container or either endpoint, so it survives a responsive
 * breakpoint, a font swap and a node appearing mid-diagram.
 *
 * The pulse is one `stroke-dashoffset` animation on a second copy of the path —
 * a dash of `beamLength` followed by a gap the length of the whole path, walked
 * backwards. That gives a travelling comet with no JS in the frame loop, and it
 * follows the curve exactly because it *is* the curve.
 */
export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 60,
  reverse = false,
  duration = 3,
  delay = 0,
  pathColor = "var(--color-line-strong)",
  pathWidth = 1.75,
  pathOpacity = 1,
  beamColor = "var(--color-accent-strong)",
  beamLength = 46,
  paused = false,
  className,
}: AnimatedBeamProps) {
  const id = useId();
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const from = fromRef.current;
    const to = toRef.current;
    if (!container || !from || !to) return;

    const measure = () => {
      const box = container.getBoundingClientRect();
      const start = centreIn(box, from.getBoundingClientRect());
      const end = centreIn(box, to.getBoundingClientRect());

      // Bow perpendicular to the line, so the curve looks right whatever the
      // angle between the two nodes happens to be.
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const span = Math.hypot(dx, dy) || 1;
      const controlX = midX + (-dy / span) * curvature;
      const controlY = midY + (dx / span) * curvature;

      const d = `M ${start.x},${start.y} Q ${controlX},${controlY} ${end.x},${end.y}`;

      // Quadratic arc length, approximated well enough for a dash pattern.
      const chord = span;
      const legs =
        Math.hypot(controlX - start.x, controlY - start.y) +
        Math.hypot(end.x - controlX, end.y - controlY);

      setGeometry({
        width: box.width,
        height: box.height,
        d,
        length: (chord + legs) / 2,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(from);
    observer.observe(to);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [containerRef, fromRef, toRef, curvature]);

  if (!geometry) return null;

  const total = Math.round(geometry.length);
  // One lap is the whole dash pattern — the lit dash plus the gap behind it.
  // Reversing flips the sign, which flips the direction of travel.
  const lap = total + beamLength;
  const travel = reverse ? lap : -lap;

  return (
    <svg
      aria-hidden="true"
      width={geometry.width}
      height={geometry.height}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      fill="none"
      className={cn("pointer-events-none absolute left-0 top-0", className)}
    >
      <path
        d={geometry.d}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={`beam-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={beamColor} stopOpacity="0" />
          <stop offset="50%" stopColor={beamColor} stopOpacity="1" />
          <stop offset="100%" stopColor={beamColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="motion-safe-only"
        d={geometry.d}
        stroke={`url(#beam-${id})`}
        strokeWidth={pathWidth + 1.25}
        strokeLinecap="round"
        strokeDasharray={`${beamLength} ${total}`}
        strokeDashoffset={0}
        style={
          {
            "--beam-travel": travel,
            animation: `beam-dash ${duration}s linear infinite`,
            animationDelay: `${delay}s`,
            animationPlayState: paused ? "paused" : "running",
          } as CSSProperties
        }
      />
    </svg>
  );
}

export default AnimatedBeam;
