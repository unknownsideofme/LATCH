"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createCoordinator, listen } = require("../../../backend/coordinator/server/CoordinatorServerApp");

test("coordinator HTTP boundary binds to loopback and enforces lease ownership", async () => {
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "latch-coordinator-http-"));
  const { app, server, lockTable } = createCoordinator({ workspacePath });

  try {
    const port = await listen(server, 0);
    app.set("port", port);
    // Coordinator RPC trusts its loopback-only listener rather than an HTTP token.
    assert.equal(server.address().address, "127.0.0.1");
    const baseUrl = `http://127.0.0.1:${port}`;

    const post = async (pathname, body) => {
      const response = await fetch(`${baseUrl}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };

    const malformed = await fetch(`${baseUrl}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    await malformed.text();

    const claimed = await post("/claim", {
      agentId: "owner:host:s1",
      file: "src/config.json",
      workspaceId: workspacePath,
    });
    assert.equal(claimed.status, 200);
    assert.equal(claimed.body.allowed, true);

    const conflict = await post("/claim", {
      agentId: "other:host:s2",
      file: "src/config.json",
      workspaceId: workspacePath,
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, "FILE_LOCKED");

    const lease = claimed.body.lock;
    const forgedHeartbeat = await post("/heartbeat", {
      agentId: "other:host:s2",
      file: lease.filePath,
      workspaceId: workspacePath,
      ownershipToken: lease.ownershipToken,
      fencingToken: lease.fencingToken,
    });
    assert.deepEqual(forgedHeartbeat.body, {
      ok: false,
      renewed: 0,
      reason: "lease_required",
    });

    const forgedRelease = await post("/release", {
      agentId: "other:host:s2",
      file: lease.filePath,
      workspaceId: workspacePath,
      ownershipToken: lease.ownershipToken,
      fencingToken: lease.fencingToken,
    });
    assert.equal(forgedRelease.body.ok, false);
    assert.equal(forgedRelease.body.reason, "not_holder");
    assert.ok(lockTable.getLock(lease.filePath, workspacePath));

    const heartbeat = await post("/heartbeat", {
      agentId: "owner:host:s1",
      file: lease.filePath,
      workspaceId: workspacePath,
      ownershipToken: lease.ownershipToken,
      fencingToken: lease.fencingToken,
    });
    assert.equal(heartbeat.body.ok, true);
    assert.equal(heartbeat.body.renewed, 1);

    const released = await post("/release", {
      agentId: "owner:host:s1",
      file: lease.filePath,
      workspaceId: workspacePath,
      ownershipToken: lease.ownershipToken,
      fencingToken: lease.fencingToken,
    });
    assert.deepEqual(released.body, { ok: true, released: true });
  } finally {
    lockTable.stopCleanup();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
});
