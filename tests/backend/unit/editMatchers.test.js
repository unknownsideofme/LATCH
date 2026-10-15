"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  matcherToSet,
  EDIT,
  READ,
  EDIT_TOOL_SETS,
} = require("../../../backend/lib/editMatchers");

test("editMatchers: matcherToSet splits pipe strings and trims whitespace", () => {
  const set = matcherToSet("Edit | Write|NotebookEdit |  ");
  assert.equal(set.size, 3);
  assert.ok(set.has("Edit"));
  assert.ok(set.has("Write"));
  assert.ok(set.has("NotebookEdit"));
  assert.equal(set.has(""), false);
});

test("editMatchers: EDIT contains expected agent tool matchers", () => {
  assert.ok(EDIT.cursor.includes("Write"));
  assert.ok(EDIT.claude.includes("NotebookEdit"));
  assert.ok(EDIT.antigravity.includes("write_to_file"));
  assert.ok(EDIT.copilot.includes("edit"));
  assert.ok(EDIT.codex.includes("apply_patch"));
});

test("editMatchers: EDIT_TOOL_SETS has quick Set lookups", () => {
  assert.equal(EDIT_TOOL_SETS.cursor.has("Write"), true);
  assert.equal(EDIT_TOOL_SETS.cursor.has("StrReplace"), true);
  assert.equal(EDIT_TOOL_SETS.claude.has("MultiEdit"), true);
  assert.equal(EDIT_TOOL_SETS.antigravity.has("multi_replace_file_content"), true);
  assert.equal(EDIT_TOOL_SETS.antigravity.has("read_file"), false);
});

test("editMatchers: READ matchers identify read operations", () => {
  const claudeReads = matcherToSet(READ.claude);
  assert.equal(claudeReads.has("Read"), true);
  assert.equal(claudeReads.has("Grep"), true);

  const agyReads = matcherToSet(READ.antigravity);
  assert.equal(agyReads.has("view_file"), true);
  assert.equal(agyReads.has("grep_search"), true);
});
