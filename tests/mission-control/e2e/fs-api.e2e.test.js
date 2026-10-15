"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");

test("mission-control e2e: /api/fs GET handler directory exploration", async () => {
  const { GET } = await import("../../../mission-control/app/api/fs/route.ts");

  // 1. Root query without path param returns root drive/list
  const rootReq = new Request("http://localhost:3002/api/fs");
  const rootRes = await GET(rootReq);
  assert.equal(rootRes.status, 200);
  const rootData = await rootRes.json();
  assert.equal(rootData.path, null);
  assert.ok(Array.isArray(rootData.entries));

  // 2. Querying an existing directory returns sorted entries and parent
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "latch-fs-test-"));
  const subDir = path.join(tempDir, "z_folder");
  const fileA = path.join(tempDir, "a_file.txt");
  fs.mkdirSync(subDir);
  fs.writeFileSync(fileA, "hello");

  try {
    const dirReq = new Request(`http://localhost:3002/api/fs?path=${encodeURIComponent(tempDir)}`);
    const dirRes = await GET(dirReq);
    assert.equal(dirRes.status, 200);
    const dirData = await dirRes.json();
    assert.equal(dirData.path, tempDir);
    assert.ok(Array.isArray(dirData.entries));
    assert.equal(dirData.entries.length, 2);

    // Directories sort before files regardless of alphabetical order
    assert.equal(dirData.entries[0].name, "z_folder");
    assert.equal(dirData.entries[0].isDir, true);
    assert.equal(dirData.entries[1].name, "a_file.txt");
    assert.equal(dirData.entries[1].isDir, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // 3. Querying non-existent directory returns 400 with error
  const badReq = new Request("http://localhost:3002/api/fs?path=/non_existent_folder_abc_123");
  const badRes = await GET(badReq);
  assert.equal(badRes.status, 400);
  const badData = await badRes.json();
  assert.ok(badData.error);
});
