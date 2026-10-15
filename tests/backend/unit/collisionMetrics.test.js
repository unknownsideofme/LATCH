"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  defaultCollisionStats,
  totalSaved,
  getCollisionStats,
  recordCollision,
} = require("../../../backend/lib/collisionMetrics");

test("collisionMetrics: defaultCollisionStats returns initial zeroed structure", () => {
  const stats = defaultCollisionStats();
  assert.equal(stats.claimsBlocked, 0);
  assert.equal(stats.patchesBlocked, 0);
  assert.equal(stats.patchesSkipped, 0);
  assert.equal(stats.mergesFlagged, 0);
  assert.equal(stats.totalSaved, 0);
  assert.deepEqual(stats.recent, []);
});

test("collisionMetrics: totalSaved sums all prevented conflicts", () => {
  const c = {
    claimsBlocked: 2,
    patchesBlocked: 3,
    patchesSkipped: 1,
    patchesDeferred: 10, // not counted in totalSaved
    mergesFlagged: 4,
  };
  assert.equal(totalSaved(c), 10);
});

test("collisionMetrics: getCollisionStats falls back gracefully on empty project", () => {
  const stats = getCollisionStats(null);
  assert.ok(stats);
  assert.equal(typeof stats.totalSaved, "number");
});

test("collisionMetrics: recordCollision returns defaults when projectId or kind missing", () => {
  const empty1 = recordCollision(null, "claim_blocked");
  assert.equal(empty1.totalSaved, 0);
  const empty2 = recordCollision("proj-1", null);
  assert.equal(empty2.totalSaved, 0);
});
