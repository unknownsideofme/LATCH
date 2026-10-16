"use strict";

const assert = require("node:assert/strict");
const { ContextService } = require("../../../backend/services/ContextService");
const { NoticeService } = require("../../../backend/services/NoticeService");
const { WorkspaceService } = require("../../../backend/services/WorkspaceService");
const { PatchService } = require("../../../backend/services/PatchService");
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
