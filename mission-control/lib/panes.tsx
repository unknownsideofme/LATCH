"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/* Chamber sizing. The center is the workspace, so it wins every negotiation:
   the sides shrink to their minimums first, and only then does one of them
   collapse. Defaults are the widths the layout shipped with. */
export {
  RAIL_W,
  LEFT_MIN,
  LEFT_MAX,
  LEFT_DEFAULT,
  RIGHT_MIN,
  RIGHT_MAX,
  RIGHT_DEFAULT,
  CENTER_MIN,
  clamp,
  fit,
  maxFor,
  presetOf,
  type PaneState,
  type PanePreset,
} from "./panesLogic";

import {
  RAIL_W,
  LEFT_MIN,
  LEFT_MAX,
  LEFT_DEFAULT,
  RIGHT_MIN,
  RIGHT_MAX,
  RIGHT_DEFAULT,
  clamp,
  fit,
  maxFor,
  presetOf,
  type PaneState,
  type PanePreset,
} from "./panesLogic";

const KEY = "latch.panes.v1";
const LEGACY_KEY = "relay.panes.v1";

const DEFAULTS: PaneState = {
  left: LEFT_DEFAULT,
  right: RIGHT_DEFAULT,
  leftOpen: true,
  rightOpen: true,
};

export type Panes = PaneState & {
  dragging: "left" | "right" | null;
  preset: PanePreset;
  startDrag: (side: "left" | "right", e: React.PointerEvent) => void;
  nudge: (side: "left" | "right", delta: number) => void;
  reset: (side: "left" | "right") => void;
  setPreset: (preset: PanePreset) => void;
};

const PanesCtx = createContext<Panes | null>(null);

export function PanesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaneState>(DEFAULTS);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  // Reads during render would desync SSR markup, so restore after mount.
  const hydrated = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY) || window.localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PaneState>;
        setState((s) => ({
          left: clamp(Number(saved.left) || s.left, LEFT_MIN, LEFT_MAX),
          right: clamp(Number(saved.right) || s.right, RIGHT_MIN, RIGHT_MAX),
          leftOpen: saved.leftOpen !== false,
          rightOpen: saved.rightOpen !== false,
        }));
      }
    } catch {
      /* private mode, blocked storage — defaults are fine */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  useEffect(() => {
    const onResize = () => setState((s) => fit(s, window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startDrag = useCallback((side: "left" | "right", e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(side);
    const move = (ev: PointerEvent) => {
      const vw = window.innerWidth;
      const raw = side === "left" ? ev.clientX - RAIL_W : vw - ev.clientX;
      const s = stateRef.current;
      const min = side === "left" ? LEFT_MIN : RIGHT_MIN;
      const next = clamp(Math.round(raw), min, maxFor(side, s, vw));
      setState((cur) => (cur[side] === next ? cur : { ...cur, [side]: next }));
    };
    const up = () => {
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }, []);

  const nudge = useCallback((side: "left" | "right", delta: number) => {
    setState((s) => {
      const min = side === "left" ? LEFT_MIN : RIGHT_MIN;
      return { ...s, [side]: clamp(s[side] + delta, min, maxFor(side, s, window.innerWidth)) };
    });
  }, []);

  const reset = useCallback((side: "left" | "right") => {
    setState((s) => ({ ...s, [side]: side === "left" ? LEFT_DEFAULT : RIGHT_DEFAULT }));
  }, []);

  // Hiding a chamber keeps its width around; showing it lands there again.
  const setPreset = useCallback((preset: PanePreset) => {
    setState((s) =>
      fit(
        {
          ...s,
          leftOpen: preset === "all" || preset === "left",
          rightOpen: preset === "all" || preset === "right",
        },
        window.innerWidth
      )
    );
  }, []);

  const value = useMemo<Panes>(
    () => ({ ...state, dragging, preset: presetOf(state), startDrag, nudge, reset, setPreset }),
    [state, dragging, startDrag, nudge, reset, setPreset]
  );
  return <PanesCtx.Provider value={value}>{children}</PanesCtx.Provider>;
}

export function usePanes() {
  const ctx = useContext(PanesCtx);
  if (!ctx) throw new Error("usePanes outside PanesProvider");
  return ctx;
}
