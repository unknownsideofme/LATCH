"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isSupabaseConfigured, loadSupabaseConfig } = require("./client");
const { SupabaseLockAdapter } = require("./SupabaseLockAdapter");
const { SupabaseSyncAdapter } = require("./SupabaseSyncAdapter");

test("Supabase: config loader returns object", () => {
  const config = loadSupabaseConfig();
  assert.ok(typeof config === "object");
  assert.ok("url" in config);
  assert.ok("key" in config);
});

test("Supabase: lock adapter initializes and handles unconfigured environment gracefully", async () => {
  const adapter = new SupabaseLockAdapter();
  assert.equal(typeof adapter.enabled, "boolean");

  if (!adapter.enabled) {
    // When Supabase is not configured, it fails open returning null/empty
    const claimResult = await adapter.claim({
      workspaceId: "test-ws",
      file: "test.ts",
      agentId: "test-agent",
    });
    assert.equal(claimResult, null);

    const listResult = await adapter.list("test-ws");
    assert.deepEqual(listResult, []);

    const releaseResult = await adapter.release({
      workspaceId: "test-ws",
      file: "test.ts",
      agentId: "test-agent",
    });
    assert.equal(releaseResult, null);
  }
});

test("Supabase: sync adapter initializes and handles unconfigured environment gracefully", async () => {
  const sync = new SupabaseSyncAdapter();
  assert.equal(typeof sync.enabled, "boolean");

  if (!sync.enabled) {
    const published = await sync.publishPatch("test-ws", {
      id: "patch-1",
      file: "app.ts",
      agent: "Cursor",
      ownerLogin: "dev",
    });
    assert.equal(published, false);
  }
});
