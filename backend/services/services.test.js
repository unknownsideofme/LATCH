"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ContextService } = require("./ContextService");
const { NoticeService } = require("./NoticeService");
const { parsePort, DEFAULT_PORT } = require("../config/constants");

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

test("Constants: parsePort fallback and CLI parsing", () => {
  assert.equal(parsePort([]), DEFAULT_PORT);
  assert.equal(parsePort(["--port", "4500"]), 4500);
});
