"use strict";

const assert = require("node:assert/strict");

test("mission-control e2e: /api/github/repos route handler returns safe structure", async () => {
  const { GET } = await import("../../../mission-control/app/api/github/repos/route.ts");

  const req = new Request("http://localhost:3002/api/github/repos?refresh=1");
  const res = await GET(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.ok("repos" in data);
  assert.ok(Array.isArray(data.repos));
  assert.ok("error" in data);
  // If gh is not logged in or not installed, error is a string; otherwise null
  if (data.error !== null) {
    assert.equal(typeof data.error, "string");
  }
});
