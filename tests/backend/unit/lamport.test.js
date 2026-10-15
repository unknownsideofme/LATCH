"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { tick, peek } = require("../../../backend/lib/lamport");

test("lamport: tick increments clock monotonically", () => {
  const ws = `test-ws-${Date.now()}`;
  assert.equal(peek(ws), 0);
  assert.equal(tick(ws), 1);
  assert.equal(tick(ws), 2);
  assert.equal(peek(ws), 2);
});

test("lamport: tick catches up to higher incoming clock", () => {
  const ws = `catchup-ws-${Date.now()}`;
  assert.equal(tick(ws, 10), 11);
  assert.equal(tick(ws, 5), 12); // local clock is already 11, so it increments to 12
  assert.equal(tick(ws, 20), 21); // higher incoming clock 20 advances to 21
});

test("lamport: workspaces maintain isolated clocks", () => {
  const ws1 = `iso-ws-1-${Date.now()}`;
  const ws2 = `iso-ws-2-${Date.now()}`;
  tick(ws1, 50);
  tick(ws2, 10);
  assert.equal(peek(ws1), 51);
  assert.equal(peek(ws2), 11);
});
