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
const { canonicalWorkspaceFile } = require("../../../backend/lib/paths");

test("lockTable helper: normalizeFile handles slashes, prefixes, whitespace", () => {
  assert.equal(normalizeFile("src\\index.js"), "src/index.js");
  assert.equal(normalizeFile("./src/index.js"), "src/index.js");
  assert.equal(normalizeFile("  app/model.ts  "), "app/model.ts");
  assert.equal(normalizeFile(null), "");
  assert.equal(normalizeFile("../../outside.txt"), "");
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
  assert.equal(claim2.status, "DENIED");
  assert.equal(claim2.code, "FILE_LOCKED");
  assert.equal(claim2.canonicalPath, "src/app.ts");
  assert.ok(claim2.owner.agentId);
  assert.ok(claim2.expiresInMs > 0);
  assert.ok(claim2.reason);
  assert.ok(claim2.reason.includes("locked"));

  // Agent 1 re-claims same file -> renewed
  const renew = table.claim({
    agentId: "claude:host1:sess1",
    file: "src/app.ts",
    workspaceId: ws,
    ownershipToken: claim1.lock.ownershipToken,
    fencingToken: claim1.lock.fencingToken,
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
    ownershipToken: renew.lock.ownershipToken,
    fencingToken: renew.lock.fencingToken,
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
  assert.ok(claim3.lock.fencingToken > claim1.lock.fencingToken);
  assert.equal(table.release({
    agentId: "claude:host1:sess1",
    file: "src/app.ts",
    workspaceId: ws,
    ownershipToken: claim1.lock.ownershipToken,
    fencingToken: claim1.lock.fencingToken,
  }).ok, false);
  assert.equal(table.getLock("src/app.ts", ws).agentId, "cursor:host1:sess2");
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

test("LockTable: simultaneous claims grant a file to exactly one owner", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-race-ws-"));
  try {
    const table = new LockTable();
    const results = await Promise.all([
      Promise.resolve().then(() => table.claim({ agentId: "agent:a:s1", file: "same.ts", workspaceId: ws })),
      Promise.resolve().then(() => table.claim({ agentId: "agent:b:s2", file: "same.ts", workspaceId: ws })),
    ]);
    assert.equal(results.filter((result) => result.allowed).length, 1);
    assert.equal(results.filter((result) => result.code === "FILE_LOCKED").length, 1);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("LockTable: heartbeat and releaseAll", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-test-ws-hb-"));
 try {
  const table = new LockTable();

  const x = table.claim({ agentId: "agent1:host1:s1", file: "x.ts", workspaceId: ws });
  const y = table.claim({ agentId: "agent1:host1:s1", file: "y.ts", workspaceId: ws });

  const hb = table.heartbeat({
    agentId: "agent1:host1:s1",
    workspaceId: ws,
    ownershipToken: x.lock.ownershipToken,
    fencingToken: x.lock.fencingToken,
  });
  assert.equal(hb.ok, true);
  assert.equal(hb.renewed, 1);

  const list = table.list(ws).filter((l) => !l.released);
  assert.equal(list.length, 2);

  const relAll = table.releaseAll("agent1:host1:s1", ws, [
    { file: "x.ts", ownershipToken: x.lock.ownershipToken, fencingToken: x.lock.fencingToken },
    { file: "y.ts", ownershipToken: y.lock.ownershipToken, fencingToken: y.lock.fencingToken },
  ]);
  assert.equal(relAll.released.length, 2);
  assert.equal(table.locks.size, 0);
 } finally {
 fs.rmSync(ws, { recursive: true, force: true });
 }
});

test("LockTable: stale credentials cannot renew or release and fencing survives restart", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-fenced-lock-"));
  try {
    const table = new LockTable();
    const first = table.claim({ agentId: "agent:host:s1", file: "src/a.ts", workspaceId: ws });
    assert.equal(first.lock.fencingToken, 1);
    assert.equal("ownershipToken" in table.publicEntry(table.getLock("src/a.ts", ws)), false);
    assert.equal(table.heartbeat({
      agentId: "agent:host:s1",
      file: "src/a.ts",
      workspaceId: ws,
      ownershipToken: "wrong",
      fencingToken: first.lock.fencingToken,
    }).ok, false);
    assert.equal(table.release({
      agentId: "agent:host:s1",
      file: "src/a.ts",
      workspaceId: ws,
      ownershipToken: "wrong",
      fencingToken: first.lock.fencingToken,
    }).ok, false);
    assert.equal(table.release({
      agentId: "agent:host:s1",
      file: "src/a.ts",
      workspaceId: ws,
      ownershipToken: first.lock.ownershipToken,
      fencingToken: first.lock.fencingToken,
    }).released, true);

    const restarted = new LockTable();
    const second = restarted.claim({ agentId: "agent:host:s2", file: "src/a.ts", workspaceId: ws });
    assert.equal(second.lock.fencingToken, 2);

    const seeded = table.claim({ agentId: "agent:host:s1", file: "src/b.ts", workspaceId: ws });
    table.release({
      agentId: "agent:host:s1",
      file: "src/b.ts",
      workspaceId: ws,
      ownershipToken: seeded.lock.ownershipToken,
      fencingToken: seeded.lock.fencingToken,
    });
    const mirror = new LockTable();
    const mirrored = mirror.claim({
      agentId: "agent:host:s1",
      file: "src/b.ts",
      workspaceId: ws,
      authoritativeLease: { ownershipToken: "shared-token", fencingToken: seeded.lock.fencingToken },
    });
    assert.equal(mirrored.allowed, true);
    assert.equal(mirrored.lock.fencingToken, seeded.lock.fencingToken);
    mirror.release({
      agentId: "agent:host:s1",
      file: "src/b.ts",
      workspaceId: ws,
      ownershipToken: "shared-token",
      fencingToken: seeded.lock.fencingToken,
    });
    const stale = mirror.claim({
      agentId: "agent:host:s2",
      file: "src/b.ts",
      workspaceId: ws,
      authoritativeLease: { ownershipToken: "stale-token", fencingToken: seeded.lock.fencingToken - 1 },
    });
    assert.equal(stale.allowed, false);
    assert.equal(stale.code, "STALE_FENCING_TOKEN");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("LockTable: refuses a claim when it cannot persist the fencing token", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-fence-write-failure-"));
  try {
    const table = new LockTable();
    table.dirFor = () => null;
    const result = table.claim({ agentId: "agent:host:s1", file: "a.ts", workspaceId: ws });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "STALE_FENCING_TOKEN");
    assert.equal(table.getLock("a.ts", ws), null);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("LockTable: hook leases heartbeat until their bounded keep-alive expires", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-bounded-keepalive-"));
  try {
    const table = new LockTable();
    const claimed = table.claim({
      agentId: "agent:host:s1",
      file: "a.ts",
      workspaceId: ws,
      ttl: 15000,
      keepAlive: true,
    });
    const entry = table.getLock("a.ts", ws);
    const beforeSweep = Date.now();
    entry.lastHeartbeat = beforeSweep - 6000;
    table.sweepExpired();
    assert.equal(table.getLock("a.ts", ws), entry);
    assert.ok(entry.lastHeartbeat >= beforeSweep);

    entry.lastHeartbeat = Date.now() - 16000;
    entry.keepAliveUntil = Date.now() - 1;
    table.sweepExpired();
    assert.equal(table.getLock("a.ts", ws), null);
    assert.ok(claimed.allowed);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("LockTable: failed batch preserves an existing lease owned by the requester", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-batch-existing-"));
  try {
    const table = new LockTable();
    const existing = table.claim({ agentId: "agent:host:s1", file: "a.ts", workspaceId: ws });
    table.claim({ agentId: "other:host:s2", file: "b.ts", workspaceId: ws });

    const result = table.claim({
      agentId: "agent:host:s1",
      files: ["a.ts", "b.ts"],
      workspaceId: ws,
      leases: [{ file: "a.ts", ownershipToken: existing.lock.ownershipToken, fencingToken: existing.lock.fencingToken }],
    });
    assert.equal(result.allowed, false);
    assert.equal(table.getLock("a.ts", ws).ownershipToken, existing.lock.ownershipToken);
    assert.equal(table.heartbeat({
      agentId: "agent:host:s1",
      file: "a.ts",
      workspaceId: ws,
      ownershipToken: existing.lock.ownershipToken,
      fencingToken: existing.lock.fencingToken,
    }).ok, true);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("LockTable: batch claims match existing leases by canonical file path", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-batch-canonical-lease-"));
  try {
    const table = new LockTable();
    const existing = table.claim({ agentId: "agent:host:s1", file: "src/a.ts", workspaceId: ws });

    const batch = table.claim({
      agentId: "agent:host:s1",
      files: ["src/./a.ts", "src/b.ts"],
      workspaceId: ws,
      leases: [{
        file: "src\\a.ts",
        ownershipToken: existing.lock.ownershipToken,
        fencingToken: existing.lock.fencingToken,
      }],
    });

    assert.equal(batch.allowed, true);
    assert.equal(batch.locks.find((lock) => lock.filePath === "src/a.ts").ownershipToken, existing.lock.ownershipToken);
    assert.equal(batch.locks.find((lock) => lock.filePath === "src/a.ts").fencingToken, existing.lock.fencingToken);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("paths: canonicalWorkspaceFile rejects escapes and resolves in-workspace symlinks", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-canonical-path-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "latch-canonical-outside-"));
  try {
    fs.mkdirSync(path.join(ws, "src"));
    fs.writeFileSync(path.join(ws, "src", "file.js"), "");
    fs.writeFileSync(path.join(outside, "secret.js"), "");
    assert.equal(canonicalWorkspaceFile(ws, "src/../src/file.js"), "src/file.js");
    assert.equal(canonicalWorkspaceFile(ws, "../../outside.js"), null);
    assert.equal(canonicalWorkspaceFile(ws, path.join(ws, "src", "file.js")), null);
    try {
      fs.symlinkSync(path.join(ws, "src"), path.join(ws, "alias"), process.platform === "win32" ? "junction" : "dir");
      fs.symlinkSync(outside, path.join(ws, "escape"), process.platform === "win32" ? "junction" : "dir");
      assert.equal(canonicalWorkspaceFile(ws, "alias/file.js"), "src/file.js");
      assert.equal(canonicalWorkspaceFile(ws, "escape/secret.js"), null);
    } catch (err) {
      if (!["EPERM", "EACCES", "UNKNOWN"].includes(err.code)) throw err;
    }
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
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
