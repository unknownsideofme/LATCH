"use strict";

const assert = require("node:assert/strict");
const {
  complimentary,
  complimentary2,
  complimentary3,
  corrected,
  randNum,
} = require("../../../landing/brain_animation.js");

test("landing brain_animation: complimentary functions produce valid RGB values", () => {
  const c1 = complimentary(100);
  const c2 = complimentary2(100);
  const c3 = complimentary3(100);

  assert.equal(typeof c1, "number");
  assert.equal(typeof c2, "number");
  assert.equal(typeof c3, "number");

  assert.ok(c1 >= 0 && c1 <= 255);
  assert.ok(c2 >= 0 && c2 <= 255);
  assert.ok(c3 >= 0 && c3 <= 255);
});

test("landing brain_animation: corrected clamps values within [0, 255]", () => {
  assert.equal(corrected(300), 255);
  assert.equal(corrected(-50), 0);
  assert.equal(corrected(128.4), 128);
  assert.equal(corrected(128.6), 129);
});

test("landing brain_animation: randNum returns integer in range inclusive", () => {
  for (let i = 0; i < 20; i++) {
    const val = randNum(10, 20);
    assert.ok(Number.isInteger(val));
    assert.ok(val >= 10 && val <= 20);
  }
});
