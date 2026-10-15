"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  esc,
  wrap,
  hlBash,
  hlJson,
  hlDiff,
  hlOutput,
  HIGHLIGHTERS,
} = require("../../../landing/docs.js");

test("landing docs: esc escapes special HTML characters", () => {
  assert.equal(esc("<script>alert('x & y')</script>"), "&lt;script&gt;alert('x &amp; y')&lt;/script&gt;");
});

test("landing docs: wrap creates syntax token span with escaped content", () => {
  assert.equal(wrap("tok-cmd", "latch"), '<span class="tok-cmd">latch</span>');
  assert.equal(wrap("tok-tag", "<head>"), '<span class="tok-tag">&lt;head&gt;</span>');
});

test("landing docs: hlBash tokenizes commands, flags, comments, and strings", () => {
  const code = "$ latch serve --port 3001 # start dev\n# full comment line";
  const highlighted = hlBash(code);
  assert.ok(highlighted.includes('class="tok-prompt"'));
  assert.ok(highlighted.includes('class="tok-cmd"'));
  assert.ok(highlighted.includes('class="tok-flag"'));
  assert.ok(highlighted.includes('class="tok-comment"'));
});

test("landing docs: hlJson tokenizes keys, punctuation, numbers, and strings", () => {
  const json = '{\n  "version": 1,\n  "ok": true\n}';
  const highlighted = hlJson(json);
  assert.ok(highlighted.includes('class="tok-key"'));
  assert.ok(highlighted.includes('class="tok-number"'));
  assert.ok(highlighted.includes('class="tok-punct"'));
});

test("landing docs: hlDiff highlights additions, deletions, and comments", () => {
  const diff = "+added line\n-removed line\n# comment";
  const highlighted = hlDiff(diff);
  assert.ok(highlighted.includes('class="tok-add"'));
  assert.ok(highlighted.includes('class="tok-del"'));
  assert.ok(highlighted.includes('class="tok-comment"'));
});

test("landing docs: hlOutput distinguishes ok, error, and dim text", () => {
  const out = "ok build succeeded\nERROR tests failed\nstandard console output";
  const highlighted = hlOutput(out);
  assert.ok(highlighted.includes('class="tok-cmd"'));
  assert.ok(highlighted.includes('class="tok-del"'));
  assert.ok(highlighted.includes('class="tok-dim"'));
});

test("landing docs: HIGHLIGHTERS registry provides standard highlighters", () => {
  assert.equal(typeof HIGHLIGHTERS.bash, "function");
  assert.equal(typeof HIGHLIGHTERS.shell, "function");
  assert.equal(typeof HIGHLIGHTERS.json, "function");
  assert.equal(typeof HIGHLIGHTERS.diff, "function");
  assert.equal(typeof HIGHLIGHTERS.output, "function");
  assert.equal(typeof HIGHLIGHTERS.text, "function");
});
