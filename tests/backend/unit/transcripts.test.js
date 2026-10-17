"use strict";

const assert = require("node:assert/strict");
const {
  normalizeWorkspaceRoot,
  normalizeCompare,
  pathHaystack,
  pathNeedle,
  pathsMentionedIn,
  pathsCoverWorkspace,
  cursorSlug,
  claudeSlug,
  toTs,
  eventId,
  clip,
  isRedacted,
  extractText,
  makeUnifiedDiff,
} = require("../../../backend/lib/transcripts/util");

test("transcripts/util: normalizeWorkspaceRoot and normalizeCompare", () => {
  assert.equal(normalizeWorkspaceRoot(null), null);
  assert.equal(normalizeWorkspaceRoot(""), null);

  const norm = normalizeCompare("C:\\Users\\Dev\\Project/");
  assert.equal(norm, "c:/users/dev/project");
});

test("transcripts/util: pathHaystack decodes URL encoding and normalizes slashes", () => {
  const haystack = pathHaystack("file:///c:/users/dev/my%20project//src");
  assert.equal(haystack, "file:/c:/users/dev/my project/src");
  assert.equal(pathNeedle("my%20project/"), "my project");
});

test("transcripts/util: pathsMentionedIn and pathsCoverWorkspace", () => {
  const text = "Working on /Users/dev/project/src/index.ts and /Users/dev/other/file.ts";
  const paths = pathsMentionedIn(text);
  assert.ok(paths.size >= 1);
  assert.equal(pathsCoverWorkspace(paths, "/users/dev/project"), true);
  assert.equal(pathsCoverWorkspace(paths, "/users/dev/unrelated"), false);
});

test("transcripts/util: cursorSlug and claudeSlug create sanitized identifiers", () => {
  const cSlug = cursorSlug("/Users/alice/my-app");
  assert.ok(cSlug.length > 0);
  assert.equal(cSlug.includes("/"), false);

  const clSlug = claudeSlug("/Users/alice/my-app");
  assert.ok(clSlug.length > 0);
  assert.equal(clSlug.includes("/"), false);
});

test("transcripts/util: toTs converts dates, timestamps, seconds, or fallbacks", () => {
  const now = Date.now();
  assert.equal(toTs(now), now);
  // Seconds timestamp (< 1e12) converted to ms
  const secs = 1700000000;
  assert.equal(toTs(secs), secs * 1000);
  // ISO string
  const iso = "2026-01-01T00:00:00.000Z";
  assert.equal(toTs(iso), Date.parse(iso));
  // Invalid string falls back
  assert.equal(toTs("invalid-date", 999), 999);
});

test("transcripts/util: eventId generates stable sha1 hash", () => {
  const id1 = eventId(["agent1", "file.ts", "12345"]);
  const id2 = eventId(["agent1", "file.ts", "12345"]);
  const id3 = eventId(["agent2", "file.ts", "12345"]);
  assert.equal(id1.length, 16);
  assert.equal(id1, id2);
  assert.notEqual(id1, id3);
});

test("transcripts/util: clip trims long strings with ellipsis", () => {
  const short = "hello";
  assert.equal(clip(short, 10), "hello");
  const long = "1234567890extra";
  assert.equal(clip(long, 10), "1234567890\n…");
});

test("transcripts/util: isRedacted detects empty, redaction tokens, and whitespace", () => {
  assert.equal(isRedacted(""), true);
  assert.equal(isRedacted("   "), true);
  assert.equal(isRedacted("[REDACTED]"), true);
  assert.equal(isRedacted("[redacted] [REDACTED]"), true);
  assert.equal(isRedacted("Valid message content"), false);
});

test("transcripts/util: extractText handles string, arrays, tool blocks", () => {
  assert.equal(extractText("hello"), "hello");
  assert.equal(
    extractText([
      { type: "text", text: "line 1" },
      { type: "tool_use", content: "ignore tool stdout" },
      { type: "text", text: "line 2" },
    ]),
    "line 1\nline 2"
  );
  assert.equal(extractText(null), "");
});

test("transcripts/util: makeUnifiedDiff creates standard unified diff text", () => {
  const oldText = "const a = 1;\nconst b = 2;";
  const newText = "const a = 1;\nconst b = 3;\nconst c = 4;";
  const diff = makeUnifiedDiff(oldText, newText, "config.ts");
  assert.ok(diff.includes("--- a/config.ts"));
  assert.ok(diff.includes("+++ b/config.ts"));
  assert.ok(diff.includes("-const b = 2;"));
  assert.ok(diff.includes("+const b = 3;"));
  assert.ok(diff.includes("+const c = 4;"));
});
