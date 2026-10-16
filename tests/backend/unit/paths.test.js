"use strict";

const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const {
  homeLatchDir,
  homeRelayDir,
  dataDir,
  registryPath,
  sessionPath,
  coordinatorStatePath,
  locksDirFor,
} = require("../../../backend/lib/paths");

test("paths: homeLatchDir and homeRelayDir return existing directories", () => {
  const dir1 = homeLatchDir();
  const dir2 = homeRelayDir();
  assert.ok(dir1);
  assert.equal(dir1, dir2);
  assert.ok(path.isAbsolute(dir1));
});

test("paths: dataDir, registryPath, and sessionPath point to data directory", () => {
  const data = dataDir();
  assert.ok(data.endsWith(path.join(".latch", "data")) || data.endsWith(path.join(".relay", "data")));
  assert.equal(registryPath(), path.join(data, "registry.json"));
  assert.equal(sessionPath(), path.join(data, "session.json"));
});

test("paths: coordinatorStatePath returns workspace path or global path", () => {
  const globalState = coordinatorStatePath(null);
  assert.ok(globalState.endsWith("coordinator-state.json"));

  const tmpWs = path.join(os.tmpdir(), "latch-paths-test");
  const wsState = coordinatorStatePath(tmpWs);
  assert.ok(wsState.includes(tmpWs));
  assert.ok(wsState.endsWith("coordinator-state.json"));
});

test("paths: locksDirFor returns valid lock directory", () => {
  const defaultLocks = locksDirFor(null);
  assert.ok(defaultLocks.endsWith("locks"));

  const tmpWs = path.join(os.tmpdir(), "latch-locks-test");
  const wsLocks = locksDirFor(tmpWs);
  assert.ok(wsLocks.endsWith("locks") || wsLocks.includes("locks"));
});
