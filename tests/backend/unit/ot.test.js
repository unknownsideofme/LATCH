"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseHunks,
  overlaps,
  transformPair,
  insertOrdered,
  drain,
} = require("../../../backend/lib/ot");

test("ot: parseHunks correctly parses unified diff format", () => {
  const diff = `@@ -10,4 +10,5 @@
 context line
-old line
+new line 1
+new line 2
 trailing context`;

  const hunks = parseHunks(diff);
  assert.equal(hunks.length, 5);
  assert.equal(hunks[0].line, 10);
  assert.equal(hunks[0].kind, " ");
  assert.equal(hunks[1].kind, "-");
  assert.equal(hunks[2].kind, "+");
});

test("ot: overlaps detects conflicting hunk line ranges", () => {
  const patchA = {
    file: "src/main.ts",
    diff: `@@ -10,3 +10,3 @@
-foo
+bar`,
  };
  const patchB = {
    file: "src/main.ts",
    diff: `@@ -11,3 +11,3 @@
-baz
+qux`,
  };
  const patchC = {
    file: "src/main.ts",
    diff: `@@ -100,2 +100,2 @@
-one
+two`,
  };

  assert.equal(overlaps(patchA, patchB), true);
  assert.equal(overlaps(patchA, patchC), false);
  assert.equal(overlaps({ diff: "" }, patchA), false);
});

test("ot: transformPair merges non-overlapping patches and flags overlapping ones", () => {
  // Different files
  const p1 = { file: "a.ts", lamport: 1, diff: "@@ -1 +1 @@\n-a\n+b" };
  const p2 = { file: "b.ts", lamport: 2, diff: "@@ -1 +1 @@\n-c\n+d" };
  const resDiff = transformPair(p1, p2);
  assert.equal(resDiff.ok, true);
  assert.deepEqual(resDiff.patches, [p1, p2]);

  // Same file non-overlapping
  const p3 = { file: "a.ts", lamport: 1, diff: "@@ -10 +10 @@\n-a\n+b" };
  const p4 = { file: "a.ts", lamport: 2, diff: "@@ -50 +50 @@\n-c\n+d" };
  const resNonOver = transformPair(p4, p3);
  assert.equal(resNonOver.ok, true);
  assert.deepEqual(resNonOver.patches, [p3, p4]); // ordered by lamport

  // Same file overlapping
  const p5 = { file: "a.ts", lamport: 1, diff: "@@ -10 +10 @@\n-a\n+b" };
  const p6 = { file: "a.ts", lamport: 2, diff: "@@ -10 +10 @@\n-x\n+y" };
  const resOver = transformPair(p5, p6);
  assert.equal(resOver.ok, false);
  assert.equal(resOver.manual, true);
  assert.ok(resOver.reason.includes("Conflicting patches"));
});

test("ot: insertOrdered maintains Lamport clock and filename sort", () => {
  const buffer = [
    { file: "z.ts", lamport: 2 },
    { file: "a.ts", lamport: 1 },
  ];
  const patch = { file: "b.ts", lamport: 2 };
  const result = insertOrdered(buffer, patch);
  assert.deepEqual(
    result.map((p) => `${p.lamport}:${p.file}`),
    ["1:a.ts", "2:b.ts", "2:z.ts"]
  );
});

test("ot: drain applies consecutive Lamport clocks and holds gaps", () => {
  const buffer = [
    { file: "a.ts", lamport: 1 },
    { file: "b.ts", lamport: 2 },
    { file: "c.ts", lamport: 4 }, // gap at 3
  ];

  const firstDrain = drain(buffer, 0);
  assert.equal(firstDrain.ready.length, 2);
  assert.equal(firstDrain.held.length, 1);
  assert.equal(firstDrain.lastApplied, 2);
  assert.equal(firstDrain.held[0].file, "c.ts");

  // When lamport 3 arrives
  const secondBuffer = [{ file: "missing.ts", lamport: 3 }, ...firstDrain.held];
  const secondDrain = drain(secondBuffer, firstDrain.lastApplied);
  assert.equal(secondDrain.ready.length, 2);
  assert.equal(secondDrain.held.length, 0);
  assert.equal(secondDrain.lastApplied, 4);
});
