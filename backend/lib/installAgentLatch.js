/**
 * Patch latch-os instructions + Latch MCP into every supported agent surface.
 * Cursor · Claude Code · Codex · Copilot CLI · Antigravity
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  latchOsBlock,
  agentBootstrap,
  LATCH_OS_BEGIN,
  LATCH_OS_END,
  RELAY_OS_BEGIN,
  RELAY_OS_END
} = require("./latchOsBlock");

function repoRoot() {
  return path.join(__dirname, "..", "..");
}

function mcpServerScript() {
  return path.join(repoRoot(), "backend", "mcp", "server.js");
}

function latchMcpEnv(workspacePath) {
  const env = {};
  if (workspacePath) {
    env.LATCH_WORKSPACE_PATH = path.resolve(workspacePath);
    env.RELAY_WORKSPACE_PATH = path.resolve(workspacePath);
  }
  return env;
}

function latchStdioMcp(workspacePath) {
  const script = mcpServerScript();
  return {
    command: process.execPath,
    args: [script],
    env: latchMcpEnv(workspacePath),
  };
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function patchLatchOsBlock(filePath, block) {
  const existing = readText(filePath);
  // Check for latch-os first, then fallback to relay-os
  let begin = existing.indexOf(LATCH_OS_BEGIN);
  let end = existing.indexOf(LATCH_OS_END);
  let endTagLength = LATCH_OS_END.length;

  if (begin < 0) {
    begin = existing.indexOf(RELAY_OS_BEGIN);
    end = existing.indexOf(RELAY_OS_END);
    endTagLength = RELAY_OS_END.length;
  }

  if (begin >= 0 && end > begin) {
    writeText(filePath, `${existing.slice(0, begin)}${block}${existing.slice(end + endTagLength)}`);
    return "updated";
  }
  const trimmed = existing.trimEnd();
  const sep = trimmed ? "\n\n" : "";
  writeText(filePath, `${trimmed}${sep}${block}\n`);
  return trimmed ? "appended" : "created";
}

function mergeJsonMcp(filePath, entry, { copilotType } = {}) {
  let data = {};
  try {
    data = JSON.parse(readText(filePath) || "{}");
  } catch {
    data = {};
  }
  data.mcpServers = data.mcpServers && typeof data.mcpServers === "object" ? data.mcpServers : {};
  const serverConfig = copilotType
    ? { type: "local", ...entry, tools: ["*"] }
    : { ...entry };
  data.mcpServers.latch = serverConfig;
  data.mcpServers.relay = serverConfig; // Maintain backward compat
  writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function mergeClaudeMcp(settingsPath, entry) {
  let data = {};
  try {
    data = JSON.parse(readText(settingsPath) || "{}");
  } catch {
    data = {};
  }
  data.mcpServers = data.mcpServers && typeof data.mcpServers === "object" ? data.mcpServers : {};
  data.mcpServers.latch = entry;
  data.mcpServers.relay = entry;
  writeText(settingsPath, `${JSON.stringify(data, null, 2)}\n`);
}

function mergeCodexMcp(configPath, workspacePath) {
  const node = process.execPath.replace(/\\/g, "/");
  const script = mcpServerScript().replace(/\\/g, "/");
  const ws = path.resolve(workspacePath).replace(/\\/g, "/");
  const envLines = [
    `LATCH_WORKSPACE_PATH = "${ws.replace(/"/g, '\\"')}"`,
    `RELAY_WORKSPACE_PATH = "${ws.replace(/"/g, '\\"')}"`
  ];
  const block = `[mcp_servers.latch]
command = "${node.replace(/"/g, '\\"')}"
args = ["${script.replace(/"/g, '\\"')}"]

[mcp_servers.latch.env]
${envLines.join("\n")}

[mcp_servers.relay]
command = "${node.replace(/"/g, '\\"')}"
args = ["${script.replace(/"/g, '\\"')}"]

[mcp_servers.relay.env]
${envLines.join("\n")}
`;
  let text = readText(configPath);
  const marker = "[mcp_servers.latch]";
  const oldMarker = "[mcp_servers.relay]";
  const idx = text.indexOf(marker) >= 0 ? text.indexOf(marker) : text.indexOf(oldMarker);
  if (idx >= 0) {
    const next = text.slice(idx + 18).search(/\n\[mcp_servers\.(?!latch|relay)/);
    text = next >= 0 ? `${text.slice(0, idx)}${block}${text.slice(idx + 18 + next)}` : `${text.slice(0, idx)}${block}`;
  } else {
    text = `${text.trimEnd()}\n\n${block}`;
  }
  writeText(configPath, text.endsWith("\n") ? text : `${text}\n`);
}

function cursorMdc(block) {
  return `---
description: Latch coordination — room context, locks, /latch ask
alwaysApply: true
---

${block}
`;
}

function ensureLatchDir(workspacePath) {
  const latchDir = path.join(workspacePath, ".latch");
  const relayDir = path.join(workspacePath, ".relay");
  fs.mkdirSync(latchDir, { recursive: true });
  fs.mkdirSync(relayDir, { recursive: true });
  const bootstrapContent = agentBootstrap(workspacePath);
  writeText(path.join(latchDir, "AGENT_BOOTSTRAP.md"), bootstrapContent);
  writeText(path.join(relayDir, "AGENT_BOOTSTRAP.md"), bootstrapContent);
}

function installProjectLatch(workspacePath) {
  if (!workspacePath) return { ok: false, error: "workspace_required" };
  const resolved = path.resolve(workspacePath);
  const block = latchOsBlock();
  const mcp = latchStdioMcp(resolved);
  const results = { instructions: {}, mcp: {} };

  const instructionTargets = [
    path.join(resolved, "AGENTS.md"),
    path.join(resolved, "CLAUDE.md"),
    path.join(resolved, ".github", "copilot-instructions.md"),
    path.join(resolved, ".cursorrules"),
  ];
  for (const file of instructionTargets) {
    try {
      results.instructions[path.relative(resolved, file)] = patchLatchOsBlock(file, block);
    } catch (err) {
      results.instructions[path.relative(resolved, file)] = String(err.message || err);
    }
  }

  try {
    writeText(path.join(resolved, ".cursor", "rules", "latch.mdc"), cursorMdc(block));
    results.instructions[".cursor/rules/latch.mdc"] = "created";
  } catch (err) {
    results.instructions[".cursor/rules/latch.mdc"] = String(err.message || err);
  }

  ensureLatchDir(resolved);

  try {
    mergeJsonMcp(path.join(resolved, ".cursor", "mcp.json"), mcp);
    results.mcp[".cursor/mcp.json"] = "ok";
  } catch (err) {
    results.mcp[".cursor/mcp.json"] = String(err.message || err);
  }

  try {
    mergeClaudeMcp(path.join(resolved, ".claude", "settings.json"), mcp);
    results.mcp[".claude/settings.json"] = "ok";
  } catch (err) {
    results.mcp[".claude/settings.json"] = String(err.message || err);
  }

  try {
    mergeCodexMcp(path.join(resolved, ".codex", "config.toml"), resolved);
    results.mcp[".codex/config.toml"] = "ok";
  } catch (err) {
    results.mcp[".codex/config.toml"] = String(err.message || err);
  }

  try {
    mergeJsonMcp(path.join(resolved, ".github", "mcp.json"), mcp, { copilotType: true });
    results.mcp[".github/mcp.json"] = "ok";
  } catch (err) {
    results.mcp[".github/mcp.json"] = String(err.message || err);
  }

  try {
    mergeJsonMcp(path.join(resolved, ".agents", "mcp_config.json"), mcp);
    results.mcp[".agents/mcp_config.json"] = "ok";
  } catch (err) {
    results.mcp[".agents/mcp_config.json"] = String(err.message || err);
  }

  return { ok: true, workspace: resolved, results };
}

function installGlobalLatch() {
  const home = os.homedir();
  const mcp = latchStdioMcp(null);
  const results = {};
  try {
    mergeJsonMcp(path.join(home, ".cursor", "mcp.json"), mcp);
    results["~/.cursor/mcp.json"] = "ok";
  } catch (err) {
    results["~/.cursor/mcp.json"] = String(err.message || err);
  }
  try {
    mergeClaudeMcp(path.join(home, ".claude", "settings.json"), mcp);
    results["~/.claude/settings.json"] = "ok";
  } catch (err) {
    results["~/.claude/settings.json"] = String(err.message || err);
  }
  try {
    mergeCodexMcp(path.join(home, ".codex", "config.toml"), home);
    results["~/.codex/config.toml"] = "ok";
  } catch (err) {
    results["~/.codex/config.toml"] = String(err.message || err);
  }
  try {
    const copilotPath = path.join(home, ".copilot", "mcp-config.json");
    mergeJsonMcp(copilotPath, mcp, { copilotType: true });
    results["~/.copilot/mcp-config.json"] = "ok";
  } catch (err) {
    results["~/.copilot/mcp-config.json"] = String(err.message || err);
  }
  try {
    const geminiMcpPath = path.join(home, ".gemini", "config", "mcp_config.json");
    mergeJsonMcp(geminiMcpPath, mcp);
    results["~/.gemini/config/mcp_config.json"] = "ok";
  } catch (err) {
    results["~/.gemini/config/mcp_config.json"] = String(err.message || err);
  }
  try {
    const globalRulePath = path.join(home, ".gemini", "config", "rules", "latch.md");
    writeText(globalRulePath, latchOsBlock());
    results["~/.gemini/config/rules/latch.md"] = "ok";
  } catch (err) {
    results["~/.gemini/config/rules/latch.md"] = String(err.message || err);
  }
  return results;
}

module.exports = {
  installProjectLatch,
  installGlobalLatch,
  installProjectRelay: installProjectLatch,
  installGlobalRelay: installGlobalLatch,
  latchStdioMcp,
  relayStdioMcp: latchStdioMcp,
  patchLatchOsBlock,
  patchRelayOsBlock: patchLatchOsBlock,
  latchOsBlock,
  relayOsBlock: latchOsBlock,
};
