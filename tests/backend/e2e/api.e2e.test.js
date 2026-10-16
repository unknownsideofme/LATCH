"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { createApp } = require("../../../backend/app");
const { LockTable } = require("../../../backend/coordinator/lockTable");
const { LockService } = require("../../../backend/services/LockService");
const { NoticeService } = require("../../../backend/services/NoticeService");
const { WorkspaceService } = require("../../../backend/services/WorkspaceService");

function startServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

test("backend e2e: full HTTP API lifecycle and endpoints", async () => {
  const fakeSse = { emit: () => {} };
  const lockTable = new LockTable();
  const noticeService = new NoticeService(fakeSse);
  const lockService = new LockService({
    lockTable,
    roomLocks: null,
    sse: fakeSse,
    wssControlRef: null,
  });
  const workspaceService = new WorkspaceService({ sse: fakeSse });

  const services = {
    sse: fakeSse,
    watcher: { on: () => {} },
    presence: { list: () => [] },
    lockTable,
    lockService,
    noticeService,
    patchService: { getPendingPatches: () => [] },
    roomService: { getStatus: () => ({ hosting: false }) },
    transcriptService: { getHistory: () => [] },
    workspaceService,
    guestClient: null,
    getCoordPort: () => 3001,
  };

  const app = createApp(services);
  const { server, baseUrl } = await startServer(app);

  try {
    // 1. Health endpoint
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.ok, true);
    assert.ok(healthData.version);

    // 2. Root HTML endpoint
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    const rootHtml = await rootRes.text();
    assert.ok(rootHtml.includes("Latch API") || rootHtml.includes("html"));

    // 3. Notices endpoint
    const noticesRes = await fetch(`${baseUrl}/api/notices`);
    assert.equal(noticesRes.status, 200);
    const noticesData = await noticesRes.json();
    assert.equal(noticesData.ok, true);
    assert.ok(Array.isArray(noticesData.notices));

    // 4. Locks status
    const locksRes = await fetch(`${baseUrl}/api/locks`);
    assert.equal(locksRes.status, 200);
    const locksData = await locksRes.json();
    assert.ok(Array.isArray(locksData.locks));

    // 5. Claim lock over HTTP
    const claimRes = await fetch(`${baseUrl}/api/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "test-agent:host:sess1",
        file: "src/server.ts",
        workspaceId: "/test/ws",
        ttl: 10000,
      }),
    });
    assert.equal(claimRes.status, 200);
    const claimData = await claimRes.json();
    assert.equal(claimData.allowed, true);

    // 6. Release lock over HTTP
    const releaseRes = await fetch(`${baseUrl}/api/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "test-agent:host:sess1",
        file: "src/server.ts",
        workspaceId: "/test/ws",
      }),
    });
    assert.equal(releaseRes.status, 200);
    const releaseData = await releaseRes.json();
    assert.equal(releaseData.ok, true);
  } finally {
    await stopServer(server);
  }
});
