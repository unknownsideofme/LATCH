"use strict";

const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  LockTable,
  DEFAULT_TTL_MS,
  normalizeFile,
  lockHash,
  sameOwner,
  normWorkspace,
  workspaceRoot,
  filterKeys,
} = require("../../../backend/coordinator/lockTable");

test("lockTable helper: normalizeFile handles slashes, prefixes, whitespace", () => {
  assert.equal(normalizeFile("src\\index.js"), "src/index.js");
  assert.equal(normalizeFile("./src/index.js"), "src/index.js");
  assert.equal(normalizeFile("  app/model.ts  "), "app/model.ts");
  assert.equal(normalizeFile(null), "");
});

test("lockTable helper: normWorkspace lowercases and trims trailing slashes", () => {
  assert.equal(normWorkspace("/Users/DEV/Repo/"), "/users/dev/repo");
  assert.equal(normWorkspace("C:\\Projects\\App\\"), "c:/projects/app");
  assert.equal(normWorkspace(""), "");
});

test("lockTable helper: workspaceRoot validates and resolves paths", () => {
  assert.equal(workspaceRoot(""), null);
  assert.equal(workspaceRoot("relative_no_slash"), null);
  const resolved = workspaceRoot("/path/to/project");
  assert.ok(resolved);
  assert.equal(typeof resolved, "string");
});

test("lockTable helper: lockHash creates 16-char hex sha256", () => {
  const hash1 = lockHash("app.js", "/ws/1");
  const hash2 = lockHash("app.js", "/ws/1");
  const hash3 = lockHash("app.js", "/ws/2");
  assert.equal(hash1.length, 16);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});

test("lockTable helper: sameOwner correctly compares sessions and labels", () => {
  assert.equal(sameOwner(null, "a"), false);
  assert.equal(sameOwner("a", null), false);
  assert.equal(sameOwner("agent1", "agent1"), true);

  // When sessions are specified on both sides, session decides
  assert.equal(sameOwner("Cursor:host1:sessionA", "Claude:host1:sessionA"), true);
  assert.equal(sameOwner("Cursor:host1:sessionA", "Cursor:host1:sessionB"), false);

  // Different host is never the same owner
  assert.equal(sameOwner("Cursor:host1:sessionA", "Cursor:host2:sessionA"), false);

  // Fallback to label when session is absent or empty
  assert.equal(sameOwner("Cursor:host1:", "Cursor:host1:"), true);
  assert.equal(sameOwner("Cursor:host1:local", "Cursor:host1:local"), true);
  assert.equal(sameOwner("Cursor:host1:local", "Claude:host1:local"), false);
});

test("lockTable helper: filterKeys handles string and object filters", () => {
  const keysFromString = filterKeys("/Users/test/repo");
  assert.ok(keysFromString.has("/users/test/repo"));

  const keysFromObj = filterKeys({
    id: "proj-1",
    path: "/Users/test/repo",
    workspaceId: "/Users/test/repo",
    aliases: ["/alias/path"],
  });
  assert.ok(keysFromObj.has("proj-1"));
  assert.ok(keysFromObj.has("/users/test/repo"));
  assert.ok(keysFromObj.has("/alias/path"));
});

test("LockTable: claim write lock and prevent cross-agent collisions", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-test-ws-"));
 try {
  const table = new LockTable();

  // Agent 1 claims file
  const claim1 = table.claim({
    agentId: "claude:host1:sess1",
    file: "src/app.ts",
    workspaceId: ws,
    ttl: 10000,
  });
  assert.equal(claim1.allowed, true);
  assert.ok(claim1.lock);
  assert.equal(claim1.lock.filePath, "src/app.ts");

  // Agent 2 attempts to claim same file -> blocked
  const claim2 = table.claim({
    agentId: "cursor:host1:sess2",
    file: "src/app.ts",
    workspaceId: ws,
    ttl: 10000,
  });
  assert.equal(claim2.allowed, false);
  assert.ok(claim2.reason);
  assert.ok(claim2.reason.includes("locked"));

  // Agent 1 re-claims same file -> renewed
  const renew = table.claim({
    agentId: "claude:host1:sess1",
    file: "src/app.ts",
    workspaceId: ws,
  });
  assert.equal(renew.allowed, true);
  assert.equal(renew.renewed, true);

  // Release by Agent 2 (not holder) -> rejected
  const releaseBad = table.release({
    agentId: "cursor:host1:sess2",
    file: "src/app.ts",
    workspaceId: ws,
  });
  assert.equal(releaseBad.ok, false);
  assert.equal(releaseBad.reason, "not_holder");

  // Release by Agent 1 (holder) -> success
  const releaseGood = table.release({
    agentId: "claude:host1:sess1",
    file: "src/app.ts",
    workspaceId: ws,
  });
  assert.equal(releaseGood.ok, true);
  assert.equal(releaseGood.released, true);

  // Now Agent 2 can claim it
  const claim3 = table.claim({
    agentId: "cursor:host1:sess2",
    file: "src/app.ts",
    workspaceId: ws,
  });
  assert.equal(claim3.allowed, true);
 } finally {
 fs.rmSync(ws, { recursive: true, force: true });
 }
});

test("LockTable: read mode presence tracking does not block writers", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-test-ws-"));
 try {
  const table = new LockTable();

  // Note a read presence
  const readRes = table.claim({
    agentId: "viewer:host1:sess1",
    file: "src/readme.md",
    workspaceId: ws,
    mode: "read",
  });
  assert.equal(readRes.allowed, true);
  assert.equal(readRes.reading, true);

  // Writer can still claim it
  const writeRes = table.claim({
    agentId: "writer:host1:sess2",
    file: "src/readme.md",
    workspaceId: ws,
    mode: "write",
  });
  assert.equal(writeRes.allowed, true);
 } finally {
 fs.rmSync(ws, { recursive: true, force: true });
 }
});

test("LockTable: batch claim holds all or none", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-test-ws-"));
 try {
  const table = new LockTable();

  // Agent 1 locks file B
  table.claim({
    agentId: "agent1:host1:s1",
    file: "b.ts",
    workspaceId: ws,
  });

  // Agent 2 tries to batch claim [a.ts, b.ts, c.ts]
  const batchRes = table.claim({
    agentId: "agent2:host1:s2",
    files: ["a.ts", "b.ts", "c.ts"],
    workspaceId: ws,
  });
  // Must fail because b.ts is held
  assert.equal(batchRes.allowed, false);

  // And a.ts should NOT remain locked by agent2
  const checkA = table.claim({
    agentId: "agent3:host1:s3",
    file: "a.ts",
    workspaceId: ws,
  });
  assert.equal(checkA.allowed, true);
 } finally {
 fs.rmSync(ws, { recursive: true, force: true });
 }
});

test("LockTable: heartbeat and releaseAll", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-test-ws-hb-"));
 try {
  const table = new LockTable();

  table.claim({ agentId: "agent1:host1:s1", file: "x.ts", workspaceId: ws });
  table.claim({ agentId: "agent1:host1:s1", file: "y.ts", workspaceId: ws });

  const hb = table.heartbeat({ agentId: "agent1:host1:s1", workspaceId: ws });
  assert.equal(hb.ok, true);
  assert.equal(hb.renewed, 2);

  const list = table.list(ws).filter((l) => !l.released);
  assert.equal(list.length, 2);

  const relAll = table.releaseAll("agent1:host1:s1", ws);
  assert.equal(relAll.released.length, 2);
  assert.equal(table.locks.size, 0);
 } finally {
 fs.rmSync(ws, { recursive: true, force: true });
 }
});

test("LockTable: waiters recording when claim is denied", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-test-ws-"));
 try {
  const table = new LockTable();

  table.claim({ agentId: "holder:host1:s1", file: "locked.ts", workspaceId: ws });
  table.claim({ agentId: "waiter:host1:s2", file: "locked.ts", workspaceId: ws });

  const waiters = table.takeWaiters("locked.ts", ws);
  assert.equal(waiters.length, 1);
  assert.equal(waiters[0].agentId, "waiter:host1:s2");
 } finally {
 fs.rmSync(ws, { recursive: true, force: true });
 }
});
