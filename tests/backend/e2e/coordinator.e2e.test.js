"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { LockTable } = require("../../../backend/coordinator/lockTable");

test("backend e2e: multi-agent coordinator contention and handover workflow", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "latch-e2e-ws-"));
  try {
    const table = new LockTable();
    const file = "shared/config.json";

  // Step 1: Agent Alpha claims shared config
  const claimAlpha = table.claim({
    agentId: "alpha:host1:s1",
    file,
    workspaceId: ws,
    ttl: 15000,
    holder: { label: "Alpha" },
  });
  assert.equal(claimAlpha.allowed, true);
  assert.equal(claimAlpha.lock.holder.label, "Alpha");

  // Step 2: Agent Beta attempts claim and is denied
  const claimBeta = table.claim({
    agentId: "beta:host1:s2",
    file,
    workspaceId: ws,
    holder: { label: "Beta" },
  });
  assert.equal(claimBeta.allowed, false);
  assert.ok(claimBeta.reason.includes("Alpha"));

  // Verify Beta is recorded as a waiter
  const waiters = table.takeWaiters(file, ws);
  assert.equal(waiters.length, 1);
  assert.equal(waiters[0].agentId, "beta:host1:s2");

  // Step 3: Agent Alpha heartbeats halfway through
  const hb = table.heartbeat({
    agentId: "alpha:host1:s1",
    file,
    workspaceId: ws,
  });
  assert.equal(hb.ok, true);
  assert.equal(hb.renewed, 1);

  // Step 4: Agent Alpha finishes and releases file
  const releaseAlpha = table.release({
    agentId: "alpha:host1:s1",
    file,
    workspaceId: ws,
  });
  assert.equal(releaseAlpha.ok, true);
  assert.equal(releaseAlpha.released, true);

  // Step 5: Agent Beta retries and successfully claims file
  const claimBetaSuccess = table.claim({
    agentId: "beta:host1:s2",
    file,
    workspaceId: ws,
    holder: { label: "Beta" },
  });
  assert.equal(claimBetaSuccess.allowed, true);

  // Step 6: Verify status reflects current holder
  const status = table.status(ws);
  const lockEntry = Object.values(status.locks).find((l) => l.filePath === file);
  assert.ok(lockEntry);
  assert.equal(lockEntry.agentId, "beta:host1:s2");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});
