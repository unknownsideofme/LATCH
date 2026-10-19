import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { limit, select, from } = vi.hoisted(() => {
  const limit = vi.fn();
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));
  return { limit, select, from };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from }),
}));
vi.mock("../../../serverboard/config/env.js", () => ({
  config: { supabase: { url: "https://example.supabase.co", key: "test-key" } },
}));

import { checkDbHealth } from "../../../serverboard/config/supabase.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(1000);
});

afterEach(() => {
  vi.useRealTimers();
});

function queryReturns(error) {
  limit.mockImplementation(async () => {
    await Promise.resolve();
    vi.setSystemTime(1075);
    return { error };
  });
}

test("health measures the completed users query", async () => {
  queryReturns(null);

  expect(await checkDbHealth()).toEqual({
    ok: true,
    latencyMs: 75,
    tablesReady: true,
    status: "connected",
  });
  expect(from).toHaveBeenCalledWith("users");
  expect(select).toHaveBeenCalledWith("id");
  expect(limit).toHaveBeenCalledWith(1);
});

test.each(["42P01", "42703", "PGRST204", "PGRST205"])(
  "health preserves pending migration status for %s",
  async (code) => {
    queryReturns({ code, message: "Missing schema object" });

    expect(await checkDbHealth()).toEqual({
      ok: true,
      latencyMs: 75,
      tablesReady: false,
      status: "connected (tables pending schema migration)",
    });
  },
);

test.each([
  ["", "TypeError: fetch failed"],
  ["PGRST000", "Database connection failed"],
  ["PGRST301", "Invalid JWT"],
  ["42501", "Permission denied"],
  [undefined, "Invalid API key"],
])("health reports query failure for %s", async (code, message) => {
  queryReturns({ code, message });

  expect(await checkDbHealth()).toEqual({ ok: false, latencyMs: 75, error: message });
});

test("health reports a rejected database query", async () => {
  limit.mockImplementation(async () => {
    await Promise.resolve();
    vi.setSystemTime(1075);
    throw new Error("Connection lost");
  });

  expect(await checkDbHealth()).toEqual({
    ok: false,
    latencyMs: 75,
    error: "Connection lost",
  });
});
