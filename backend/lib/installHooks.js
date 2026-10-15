const fs = require("fs");
const path = require("path");
const os = require("os");
const { EDIT, READ } = require("./editMatchers");
const { installProjectLatch, installGlobalLatch } = require("./installAgentLatch");

function repoRoot() {
  return path.join(__dirname, "..", "..");
}

function nodeCmd(scriptRel) {
  const abs = path.join(repoRoot(), scriptRel).replace(/\\/g, "/");
  return `node "${abs}"`;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function installProjectHooks(workspacePath) {
  if (!workspacePath) return;
  const claude = nodeCmd("hooks/latch-claude-pre-tool.js");
  const claudePost = nodeCmd("hooks/latch-claude-post-tool.js");
  const claudeStop = nodeCmd("hooks/latch-claude-stop.js");
  const cursor = nodeCmd("hooks/latch-cursor-pre-tool.js");
  const cursorPost = nodeCmd("hooks/latch-cursor-post-tool.js");
  const cursorStop = nodeCmd("hooks/latch-cursor-stop.js");
  const codex = nodeCmd("hooks/latch-codex-pre-tool.js");
  const codexPost = nodeCmd("hooks/latch-codex-post-tool.js");
  const codexStop = nodeCmd("hooks/latch-codex-stop.js");
  const copilot = nodeCmd("hooks/latch-copilot-pre-tool.js");
  const copilotPost = nodeCmd("hooks/latch-copilot-post-tool.js");
  const copilotStop = nodeCmd("hooks/latch-copilot-stop.js");
  const anti = nodeCmd("hooks/latch-antigravity-pre-tool.js");
  const antiPost = nodeCmd("hooks/latch-antigravity-post-tool.js");
  const antiStop = nodeCmd("hooks/latch-antigravity-stop.js");

  writeJson(path.join(workspacePath, ".claude", "settings.json"), {
    hooks: {
      PreToolUse: [
        {
          matcher: EDIT.claude,
          hooks: [{ type: "command", command: claude }],
        },
        {
          matcher: READ.claude,
          hooks: [{ type: "command", command: nodeCmd("hooks/latch-claude-pre-read.js") }],
        },
      ],
      PostToolUse: [
        {
          matcher: EDIT.claude,
          hooks: [{ type: "command", command: claudePost }],
        },
      ],
      Stop: [{ matcher: "*", hooks: [{ type: "command", command: claudeStop }] }],
    },
  });

  writeJson(path.join(workspacePath, ".cursor", "hooks.json"), {
    version: 1,
    hooks: {
      preToolUse: [
        {
          command: cursor,
          matcher: EDIT.cursor,
          timeout: 10,
        },
        {
          command: nodeCmd("hooks/latch-cursor-pre-read.js"),
          matcher: READ.cursor,
          timeout: 10,
        },
      ],
      postToolUse: [
        {
          command: cursorPost,
          matcher: EDIT.cursor,
          timeout: 10,
        },
      ],
      // Documented Cursor read hook. Payload: { file_path, content }. Matcher
      // filters by tool type (Read, TabRead, …). Fail-open by default: reporting
      // a read must never be able to stop the agent from reading.
      beforeReadFile: [
        {
          command: nodeCmd("hooks/latch-cursor-pre-read.js"),
          matcher: "Read",
          timeout: 10,
        },
      ],
      stop: [{ command: cursorStop, loop_limit: 1 }],
    },
  });

  // No read hook for Codex: it exposes no read or search tool, so file reads
  // arrive as shell commands under the Bash matcher. Matching Bash to sniff
  // reads out of a command line would report greps and cats as "reads" and miss
  // everything else, so Codex contributes edits only.
  writeJson(path.join(workspacePath, ".codex", "hooks.json"), {
    hooks: {
      PreToolUse: [
        {
          matcher: EDIT.codex,
          hooks: [{ type: "command", command: codex, timeout: 10 }],
        },
      ],
      PostToolUse: [
        {
          matcher: EDIT.codex,
          hooks: [{ type: "command", command: codexPost, timeout: 10 }],
        },
      ],
      Stop: [{ hooks: [{ type: "command", command: codexStop, timeout: 120 }] }],
    },
  });

  writeJson(path.join(workspacePath, ".github", "hooks", "latch-os.json"), {
    version: 1,
    hooks: {
      preToolUse: [
        {
          type: "command",
          bash: copilot,
          powershell: copilot,
          matcher: EDIT.copilot,
          cwd: ".",
          timeoutSec: 10,
        },
        {
          type: "command",
          bash: nodeCmd("hooks/latch-copilot-pre-read.js"),
          powershell: nodeCmd("hooks/latch-copilot-pre-read.js"),
          matcher: READ.copilot,
          cwd: ".",
          timeoutSec: 10,
        },
      ],
      postToolUse: [
        {
          type: "command",
          bash: copilotPost,
          powershell: copilotPost,
          matcher: EDIT.copilot,
          cwd: ".",
          timeoutSec: 10,
        },
      ],
      agentStop: [
        {
          type: "command",
          bash: copilotStop,
          powershell: copilotStop,
          cwd: ".",
          timeoutSec: 120,
        },
      ],
    },
  });

  writeJson(path.join(workspacePath, ".agents", "hooks.json"), antigravityHooks(anti, antiPost, antiStop));
  try {
    installProjectLatch(workspacePath);
  } catch {
    /* instructions + MCP are best-effort */
  }
}

/**
 * Antigravity's config is keyed by hook NAME at the top level, and each name
 * maps to its events — `{"relay": {"PreToolUse": [...]}}`. We were writing
 * `{"hooks": {...}}`, which only worked by accident, as a hook that happened to
 * be named "hooks".
 *
 * The event shapes also differ from each other: PreToolUse and PostToolUse take
 * a matcher group wrapping a `hooks` array, while Stop takes the handler
 * directly.
 */
function antigravityHooks(pre, post, stop) {
  return {
    latch: {
      PreToolUse: [
        {
          matcher: EDIT.antigravity,
          hooks: [{ type: "command", command: pre, timeout: 10 }],
        },
        {
          matcher: READ.antigravity,
          hooks: [{ type: "command", command: nodeCmd("hooks/latch-antigravity-pre-read.js"), timeout: 10 }],
        },
      ],
      PostToolUse: [
        {
          matcher: EDIT.antigravity,
          hooks: [{ type: "command", command: post, timeout: 10 }],
        },
      ],
      Stop: [{ type: "command", command: stop, timeout: 120 }],
    },
  };
}

function mergeClaudeSettings(file, preCmd, postCmd, stopCmd) {
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    existing = {};
  }
  existing.hooks = existing.hooks || {};
  existing.hooks.PreToolUse = [
    {
      matcher: EDIT.claude,
      hooks: [{ type: "command", command: preCmd }],
    },
    {
      matcher: READ.claude,
      hooks: [{ type: "command", command: nodeCmd("hooks/latch-claude-pre-read.js") }],
    },
  ];
  existing.hooks.PostToolUse = [
    {
      matcher: EDIT.claude,
      hooks: [{ type: "command", command: postCmd }],
    },
  ];
  existing.hooks.Stop = [{ matcher: "*", hooks: [{ type: "command", command: stopCmd }] }];
  writeJson(file, existing);
}

function installGlobalHooks() {
  const home = os.homedir();
  mergeClaudeSettings(
    path.join(home, ".claude", "settings.json"),
    nodeCmd("hooks/latch-claude-pre-tool.js"),
    nodeCmd("hooks/latch-claude-post-tool.js"),
    nodeCmd("hooks/latch-claude-stop.js")
  );
  writeJson(path.join(home, ".cursor", "hooks.json"), {
    version: 1,
    hooks: {
      preToolUse: [
        {
          command: nodeCmd("hooks/latch-cursor-pre-tool.js"),
          matcher: EDIT.cursor,
          timeout: 10,
        },
        {
          command: nodeCmd("hooks/latch-cursor-pre-read.js"),
          matcher: READ.cursor,
          timeout: 10,
        },
      ],
      postToolUse: [
        {
          command: nodeCmd("hooks/latch-cursor-post-tool.js"),
          matcher: EDIT.cursor,
          timeout: 10,
        },
      ],
      beforeReadFile: [
        {
          command: nodeCmd("hooks/latch-cursor-pre-read.js"),
          matcher: "Read",
          timeout: 10,
        },
      ],
      stop: [{ command: nodeCmd("hooks/latch-cursor-stop.js"), loop_limit: 1 }],
    },
  });
  writeJson(path.join(home, ".codex", "hooks.json"), {
    hooks: {
      PreToolUse: [
        {
          matcher: EDIT.codex,
          hooks: [{ type: "command", command: nodeCmd("hooks/latch-codex-pre-tool.js"), timeout: 10 }],
        },
      ],
      PostToolUse: [
        {
          matcher: EDIT.codex,
          hooks: [{ type: "command", command: nodeCmd("hooks/latch-codex-post-tool.js"), timeout: 10 }],
        },
      ],
      Stop: [
        {
          hooks: [{ type: "command", command: nodeCmd("hooks/latch-codex-stop.js"), timeout: 120 }],
        },
      ],
    },
  });
  const antigravity = antigravityHooks(
    nodeCmd("hooks/latch-antigravity-pre-tool.js"),
    nodeCmd("hooks/latch-antigravity-post-tool.js"),
    nodeCmd("hooks/latch-antigravity-stop.js")
  );
  // Antigravity reads global hooks from ~/.gemini/config, either directly or
  // from a plugin bundle under it.
  writeJson(path.join(home, ".gemini", "config", "plugins", "latch", "hooks.json"), antigravity);
  writeJson(path.join(home, ".gemini", "config", "plugins", "relay", "hooks.json"), antigravity);
  writeJson(path.join(home, ".gemini", "config", "hooks.json"), antigravity);
  try {
    installGlobalLatch();
  } catch {
    /* global MCP is best-effort */
  }
}

module.exports = { installProjectHooks, installGlobalHooks };
