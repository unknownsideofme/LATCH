"use strict";

const assert = require("node:assert/strict");

test("mission-control panes: clamp limits values within lower and upper bounds", async () => {
  const { clamp } = await import("../../../mission-control/lib/panesLogic.ts");
  assert.equal(clamp(150, 200, 500), 200);
  assert.equal(clamp(600, 200, 500), 500);
  assert.equal(clamp(350, 200, 500), 350);
});

test("mission-control panes: presetOf derives correct layout mode", async () => {
  const { presetOf } = await import("../../../mission-control/lib/panesLogic.ts");
  assert.equal(presetOf({ leftOpen: true, rightOpen: true }), "all");
  assert.equal(presetOf({ leftOpen: true, rightOpen: false }), "left");
  assert.equal(presetOf({ leftOpen: false, rightOpen: true }), "right");
  assert.equal(presetOf({ leftOpen: false, rightOpen: false }), "center");
});

test("mission-control panes: fit protects center minimum when viewport shrinks", async () => {
  const { fit, CENTER_MIN, RAIL_W, LEFT_MIN, RIGHT_MIN } = await import("../../../mission-control/lib/panesLogic.ts");

  // Generous viewport: both sides stay open and retain widths
  const wideState = { left: 250, right: 270, leftOpen: true, rightOpen: true };
  const fittedWide = fit(wideState, 1400);
  assert.deepEqual(fittedWide, wideState);

  // Narrow viewport: must squeeze or collapse side panes so center >= CENTER_MIN
  const narrowState = { left: 300, right: 300, leftOpen: true, rightOpen: true };
  const fittedNarrow = fit(narrowState, 800);
  const avail = 800 - RAIL_W;
  const centerSpace = avail - (fittedNarrow.leftOpen ? fittedNarrow.left : 0) - (fittedNarrow.rightOpen ? fittedNarrow.right : 0);
  assert.ok(centerSpace >= CENTER_MIN);
});

test("mission-control panes: maxFor calculates available side width based on headroom", async () => {
  const { maxFor, LEFT_MIN, LEFT_MAX } = await import("../../../mission-control/lib/panesLogic.ts");
  const state = { left: 250, right: 250, leftOpen: true, rightOpen: true };
  const maxLeft = maxFor("left", state, 1600);
  assert.ok(maxLeft >= LEFT_MIN);
  assert.ok(maxLeft <= LEFT_MAX);
});
