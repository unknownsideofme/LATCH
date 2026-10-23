import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { updateGitignore, isPatternCovered, LATCH_GITIGNORE_ENTRIES } from "../../../backend/lib/gitignore";
import { addLocal } from "../../../backend/lib/cloneRepo";

describe("backend/lib/gitignore", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "latch-gitignore-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("creates a new .gitignore with all Latch entries if none exists", () => {
    const res = updateGitignore(tempDir);
    expect(res.ok).toBe(true);
    expect(res.added).toEqual(LATCH_GITIGNORE_ENTRIES);

    const content = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf8");
    for (const entry of LATCH_GITIGNORE_ENTRIES) {
      expect(content).toContain(entry);
    }
  });

  it("is idempotent and does not re-add entries if already present", () => {
    updateGitignore(tempDir);
    const contentBefore = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf8");

    const res2 = updateGitignore(tempDir);
    expect(res2.ok).toBe(true);
    expect(res2.added).toEqual([]);

    const contentAfter = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf8");
    expect(contentAfter).toBe(contentBefore);
  });

  it("only appends missing entries to an existing .gitignore", () => {
    const initialContent = "node_modules/\n.env\n.cursor/\n.claude/\n";
    fs.writeFileSync(path.join(tempDir, ".gitignore"), initialContent, "utf8");

    const res = updateGitignore(tempDir);
    expect(res.ok).toBe(true);
    expect(res.added).not.toContain(".cursor/");
    expect(res.added).not.toContain(".claude/");
    expect(res.added).toContain(".latch/");
    expect(res.added).toContain(".github/mcp.json");

    const content = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf8");
    expect(content.startsWith("node_modules/\n.env\n.cursor/\n.claude/\n")).toBe(true);
  });

  it("recognizes existing copilot-instructions patterns", () => {
    const initialContent = "**/copilot-instructions.md\n";
    fs.writeFileSync(path.join(tempDir, ".gitignore"), initialContent, "utf8");

    const res = updateGitignore(tempDir);
    expect(res.added).not.toContain("**/copilot-instructions.md");
    expect(res.added).not.toContain(".github/copilot-instructions.md");
  });

  it("isPatternCovered correctly checks variations", () => {
    const existing = [
      "# Comment",
      "node_modules",
      ".cursor/",
      ".latch/",
      "**/copilot-instructions.md",
    ];

    expect(isPatternCovered(".cursor/", existing)).toBe(true);
    expect(isPatternCovered(".cursor", existing)).toBe(true);
    expect(isPatternCovered(".cursor/hooks.json", existing)).toBe(true);
    expect(isPatternCovered(".latch/", existing)).toBe(true);
    expect(isPatternCovered("**/copilot-instructions.md", existing)).toBe(true);
    expect(isPatternCovered(".github/copilot-instructions.md", existing)).toBe(true);
    expect(isPatternCovered(".github/mcp.json", existing)).toBe(false);
  });
});

describe("latch add directory behavior", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "latch-add-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("creates .latch folder but MUST NOT create .relay folder while .latch is there", () => {
    addLocal(tempDir, "test-add");

    expect(fs.existsSync(path.join(tempDir, ".latch"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".relay"))).toBe(false);
  });

  it("writes all added files to .gitignore on latch add", () => {
    addLocal(tempDir, "test-add-gitignore");

    const gitignorePath = path.join(tempDir, ".gitignore");
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, "utf8");
    for (const entry of LATCH_GITIGNORE_ENTRIES) {
      expect(content).toContain(entry);
    }
  });

  it("CLI: latch add . creates .latch, does not create .relay, and writes to .gitignore", async () => {
    const { execFile } = await import("child_process");
    const cliPath = path.join(__dirname, "../../../cli/latch.js");

    await new Promise((resolve, reject) => {
      execFile(process.execPath, [cliPath, "add", "."], { cwd: tempDir }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
    });

    expect(fs.existsSync(path.join(tempDir, ".latch"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".relay"))).toBe(false);

    const gitignorePath = path.join(tempDir, ".gitignore");
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const content = fs.readFileSync(gitignorePath, "utf8");
    expect(content).toContain(".latch/");
    expect(content).toContain(".cursor/");
    expect(content).toContain(".github/mcp.json");
  });
});
