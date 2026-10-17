"use strict";

const assert = require("node:assert/strict");
const { normalizePath, detectConflicts } = require("../../../backend/lib/conflicts");

test("conflicts: normalizePath normalizes slashes and casing", () => {
  assert.equal(normalizePath(".\\src\\App.tsx/"), "src/app.tsx");
  assert.equal(normalizePath("/Users/Test/Repo/"), "users/test/repo");
  assert.equal(normalizePath(null), "");
});

test("conflicts: detectConflicts finds overlapping edits within window", () => {
  const now = Date.now();
  const memory = {
    edits: [
      { file: "src/app.ts", agent: "Cursor", ts: now - 1000, diff: "@@ -1 +1 @@\n-a\n+b" },
      { file: "src/app.ts", agent: "Claude", ts: now - 2000, diff: "@@ -10 +10 @@\n-x\n+y" },
      { file: "src/header.ts", agent: "Cursor", ts: now - 500, diff: "@@ -1 +1 @@\n+c" },
      { file: "src/old.ts", agent: "Cursor", ts: now - 600000 }, // outside 5 min window
      { file: "src/old.ts", agent: "Claude", ts: now - 600000 },
    ],
  };

  const conflicts = detectConflicts(memory, 300000);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].file, "src/app.ts");
  assert.equal(conflicts[0].agents.length, 2);
  assert.ok(conflicts[0].agents.includes("Cursor"));
  assert.ok(conflicts[0].agents.includes("Claude"));
});

test("conflicts: detectConflicts returns empty when no multi-agent edits occur", () => {
  const now = Date.now();
  const memory = {
    edits: [
      { file: "a.ts", agent: "Cursor", ts: now - 1000 },
      { file: "a.ts", agent: "Cursor", ts: now - 2000 },
      { file: "b.ts", agent: "Claude", ts: now - 1000 },
    ],
  };
  const conflicts = detectConflicts(memory);
  assert.deepEqual(conflicts, []);
});
