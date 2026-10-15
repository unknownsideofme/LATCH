"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("mission-control utils: cn combines class names and filters falsy values", async () => {
  const { cn } = await import("../../../mission-control/lib/utils.ts");
  assert.equal(cn("class1", "class2"), "class1 class2");
  assert.equal(cn("class1", undefined, null, false, "class2"), "class1 class2");
  assert.equal(cn(), "");
  assert.equal(cn(false, null, undefined), "");
});
