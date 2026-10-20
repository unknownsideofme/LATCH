"use strict";

const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ContextService } = require("../../../backend/services/ContextService");
const { NoticeService } = require("../../../backend/services/NoticeService");
const { WorkspaceService } = require("../../../backend/services/WorkspaceService");
const { PatchService } = require("../../../backend/services/PatchService");
const { LockService } = require("../../../backend/services/LockService");
const { LockTable } = require("../../../backend/coordinator/lockTable");
const { SupabaseLockAdapter } = require("../../../backend/supabase/SupabaseLockAdapter");
const { parsePort, DEFAULT_PORT } = require("../../../backend/config/constants");

test("ContextService: current user resolution fallback", () => {
  const user = ContextService.currentUser();
  assert.ok(user);
  assert.ok(typeof user.login === "string");
  assert.ok(user.id);
});

test("ContextService: sameLogin case-insensitive comparison", () => {
  assert.equal(ContextService.sameLogin("Alice", "alice"), true);
  assert.equal(ContextService.sameLogin("Alice", "Bob"), false);
  assert.equal(ContextService.sameLogin(null, "Alice"), false);
});

test("NoticeService: dispatches notice and triggers SSE", () => {
  const emitted = [];
  const fakeSse = {
    emit: (event, data) => emitted.push({ event, data }),
  };
  const service = new NoticeService(fakeSse);
  const notice = service.emitNotice(
    {
      type: "test",
      key: `test_notice_key_${Date.now()}`,
      title: "Test Notice",
      body: "Testing dispatch",
    },
    { revive: true }
  );
  assert.ok(notice);
  assert.equal(notice.title, "Test Notice");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event, "notice");
  assert.equal(emitted[0].data.title, "Test Notice");
});

test("NoticeService: deduplication with same key without revive returns null", () => {
  const fakeSse = { emit: () => {} };
  const service = new NoticeService(fakeSse);
  const key = `dedup_test_${Date.now()}`;
  const first = service.emitNotice({ type: "info", key, title: "First" });
  assert.ok(first);
  const second = service.emitNotice({ type: "info", key, title: "Second" });
  // Without revive, existing notice is returned as null
  assert.equal(second, null);
});

test("Constants: parsePort fallback and CLI parsing", () => {
  assert.equal(parsePort([]), DEFAULT_PORT);
  assert.equal(parsePort(["--port", "4500"]), 4500);
  assert.equal(parsePort(["--unknown", "val"]), DEFAULT_PORT);
});

test("PatchService: patch formatting helpers", () => {
  const patchService = new PatchService({ sse: { emit: () => {} } });
  assert.ok(patchService);
  const rows = patchService.patchRows([
    { id: "p1", agent: "Cursor", ownerLogin: "dev", diff: "+line" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "p1");
  assert.equal(rows[0].agent, "Cursor");

  const row = patchService.editRowFor({
    id: "p2",
    agent: "Claude",
    ownerLogin: "dev",
    file: "a.ts",
    ts: 1000,
    diff: "+change",
    lamport: 1,
    binary: false,
  }, true);
  assert.equal(row.mine, true);
  assert.equal(row.file, "a.ts");
});

test("WorkspaceService: initialization and workspace resolution", () => {
  const wsService = new WorkspaceService({ sse: { emit: () => {} } });
  assert.ok(wsService);
  assert.equal(typeof wsService.ensureWorkspace, "function");
});

test("LockService: Supabase batch claims sort, issue per-file leases, and roll back failures", async () => {
  const workspaceId = fs.mkdtempSync(path.join(os.tmpdir(), "latch-lock-service-"));
  const claimCalls = [];
  const claimArgs = [];
  const releaseCalls = [];
  const fences = new Map();
  let shouldDeny = false;
  const supabaseLockAdapter = {
    enabled: true,
    async claim(args) {
      claimArgs.push(args);
      claimCalls.push(args.file);
      if (shouldDeny && args.file === "b.ts") return { allowed: false, code: "FILE_LOCKED" };
      const fencingToken = (fences.get(args.file) || 0) + 1;
      fences.set(args.file, fencingToken);
      return {
        allowed: true,
        file: args.file,
        sessionId: args.sessionId,
        ownershipToken: `token-${args.file}`,
        fencingToken,
      };
    },
    async release(args) {
      releaseCalls.push(args.file);
      return { ok: true, released: true };
    },
  };
  const lockTable = new LockTable();
  const service = new LockService({
    lockTable,
    roomLocks: null,
    sse: null,
    wssControlRef: null,
    supabaseLockAdapter,
  });

  try {
    const success = await service.runLockRpc("claim", {
      agentId: "agent:host:s1",
      workspaceId,
      files: ["b.ts", "a.ts"],
      keepAlive: true,
    });
    assert.equal(success.allowed, true);
    assert.deepEqual(success.batch, ["a.ts", "b.ts"]);
    assert.equal(success.locks.length, 2);
    assert.notEqual(success.locks[0].ownershipToken, success.locks[1].ownershipToken);
    assert.deepEqual(claimCalls, ["a.ts", "b.ts"]);
    assert.deepEqual(claimArgs.map(({ file, keepAlive }) => ({ file, keepAlive })), [
      { file: "a.ts", keepAlive: true },
      { file: "b.ts", keepAlive: true },
    ]);

    lockTable.releaseAll("agent:host:s1", workspaceId, success.locks.map((lock) => ({
      file: lock.filePath,
      ownershipToken: lock.ownershipToken,
      fencingToken: lock.fencingToken,
    })));
    claimCalls.length = 0;
    releaseCalls.length = 0;
    shouldDeny = true;
    const denied = await service.runLockRpc("claim", {
      agentId: "agent:host:s2",
      workspaceId,
      files: ["a.ts", "b.ts"],
    });
    assert.equal(denied.allowed, false);
    assert.deepEqual(releaseCalls, ["a.ts"]);
    assert.equal(lockTable.getLock("a.ts", workspaceId), null);
  } finally {
    fs.rmSync(workspaceId, { recursive: true, force: true });
  }
});

test("SupabaseLockAdapter: bounded keep-alive renews active hook leases and stops on release", async () => {
  const adapter = new SupabaseLockAdapter();
  const rpcCalls = [];
  adapter.client = {
    async rpc(name) {
      rpcCalls.push(name);
      if (name === "latch_claim_lock") {
        return { data: { allowed: true, ownershipToken: "lease-token", fencingToken: 4 }, error: null };
      }
      if (name === "latch_heartbeat_lock") return { data: { ok: true }, error: null };
      if (name === "latch_release_lock") return { data: { ok: true, released: true }, error: null };
      return { data: null, error: null };
    },
  };

  const lease = {
    workspaceId: "workspace",
    file: "a.ts",
    agentId: "agent:host:s1",
    sessionId: "s1",
    ttl: 5000,
    keepAlive: true,
  };
  try {
    const claimed = await adapter.claim(lease);
    assert.equal(claimed.allowed, true);
    assert.equal(adapter.keepAliveTimers.size, 1);
    await new Promise((resolve) => setTimeout(resolve, 1750));
    assert.ok(rpcCalls.includes("latch_heartbeat_lock"));

    const released = await adapter.release({
      ...lease,
      ownershipToken: "lease-token",
      fencingToken: 4,
    });
    assert.equal(released.released, true);
    assert.equal(adapter.keepAliveTimers.size, 0);
  } finally {
    for (const [key, active] of adapter.keepAliveTimers) adapter.stopKeepAlive(key);
  }
});
