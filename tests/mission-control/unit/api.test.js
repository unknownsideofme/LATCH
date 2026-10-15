"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("mission-control api: apiUrl preserves absolute URLs", async () => {
  const { apiUrl } = await import("../../../mission-control/lib/api.ts");
  assert.equal(apiUrl("https://example.com/api"), "https://example.com/api");
  assert.equal(apiUrl("http://localhost:3000/feed"), "http://localhost:3000/feed");
});

test("mission-control api: apiUrl handles relative paths with and without leading slash", async () => {
  const { apiUrl } = await import("../../../mission-control/lib/api.ts");
  // In Node environment, typeof window is undefined, so it uses internal URL fallback
  const url1 = apiUrl("/api/health");
  const url2 = apiUrl("api/health");
  assert.ok(url1.endsWith("/api/health"));
  assert.equal(url1, url2);
});
