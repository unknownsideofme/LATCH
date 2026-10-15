// Chamber sizing and layout logic for mission-control panes.

export const RAIL_W = 60; // the workspace icon rail, left of the LEFT chamber
export const LEFT_MIN = 240;
export const LEFT_MAX = 520;
export const LEFT_DEFAULT = 248;
export const RIGHT_MIN = 240;
export const RIGHT_MAX = 520;
export const RIGHT_DEFAULT = 268;
export const CENTER_MIN = 400;

export type PaneState = {
  left: number;
  right: number;
  leftOpen: boolean;
  rightOpen: boolean;
};

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Squeeze, then collapse — never let the center fall under its minimum. */
export function fit(s: PaneState, vw: number): PaneState {
  const avail = vw - RAIL_W;
  let { left, right, leftOpen, rightOpen } = s;
  const room = () => avail - (leftOpen ? left : 0) - (rightOpen ? right : 0);

  if (room() < CENTER_MIN && rightOpen) right = clamp(right, RIGHT_MIN, Math.max(RIGHT_MIN, right + room() - CENTER_MIN));
  if (room() < CENTER_MIN && leftOpen) left = clamp(left, LEFT_MIN, Math.max(LEFT_MIN, left + room() - CENTER_MIN));
  // Still short at both minimums: drop a chamber rather than crush the center.
  if (room() < CENTER_MIN && rightOpen) rightOpen = false;
  if (room() < CENTER_MIN && leftOpen) leftOpen = false;

  if (left === s.left && right === s.right && leftOpen === s.leftOpen && rightOpen === s.rightOpen) return s;
  return { left, right, leftOpen, rightOpen };
}

/** How wide a side may get right now, given the other side and the center. */
export function maxFor(side: "left" | "right", s: PaneState, vw: number) {
  const other = side === "left" ? (s.rightOpen ? s.right : 0) : s.leftOpen ? s.left : 0;
  const headroom = vw - RAIL_W - other - CENTER_MIN;
  return Math.max(side === "left" ? LEFT_MIN : RIGHT_MIN, Math.min(side === "left" ? LEFT_MAX : RIGHT_MAX, headroom));
}

export type PanePreset = "all" | "left" | "right" | "center";

export function presetOf(s: Pick<PaneState, "leftOpen" | "rightOpen">): PanePreset {
  if (s.leftOpen && s.rightOpen) return "all";
  if (s.leftOpen) return "left";
  if (s.rightOpen) return "right";
  return "center";
}
