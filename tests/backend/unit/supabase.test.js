"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isSupabaseConfigured, loadSupabaseConfig } = require("../../../backend/supabase/client");
const { SupabaseLockAdapter } = require("../../../backend/supabase/SupabaseLockAdapter");
const { SupabaseSyncAdapter } = require("../../../backend/supabase/SupabaseSyncAdapter");

test("Supabase: config loader returns object", () => {
  const config = loadSupabaseConfig();
  assert.ok(typeof config === "object");
  assert.ok("url" in config);
  assert.ok("key" in config);
});

test("Supabase: isSupabaseConfigured returns boolean", () => {
  const configured = isSupabaseConfigured();
  assert.equal(typeof configured, "boolean");
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

    const hbResult = await adapter.heartbeat({
      workspaceId: "test-ws",
      file: "test.ts",
      agentId: "test-agent",
    });
    assert.equal(hbResult, null);
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

    const read = await sync.getPendingPatches("test-ws", 0);
    assert.deepEqual(read, []);
  }
});
