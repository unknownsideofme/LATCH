/**
 * Single source of truth for the latch-os agent instruction block.
 * Patched into every agent's instruction surface on `latch add` / `latch init`.
 */

const LATCH_OS_BEGIN = "<!-- BEGIN:latch-os -->";
const LATCH_OS_END = "<!-- END:latch-os -->";

// Keep legacy markers as well so old blocks can be cleanly replaced
const RELAY_OS_BEGIN = "<!-- BEGIN:relay-os -->";
const RELAY_OS_END = "<!-- END:relay-os -->";

function latchOsBlock() {
  return `${LATCH_OS_BEGIN}
# Latch (auto-installed)

This project uses **Latch** for cross-agent memory. Do not ask the user to configure agent files manually.

**Every session — read first:** \`.latch/AGENT_BOOTSTRAP.md\`

| Phase | Action |
|-------|--------|
| Session start | Read \`.latch/latch_context.md\` (handoff). Never paste raw transcripts. |
| After agent work | **You** update \`.latch/*.md\` from \`compile_brief.md\` (stop hook triggers this) |
| Background sync | \`latch watch .\` keeps \`memory.json\` + \`compile_brief.md\` fresh |
| Not installed? | Run \`latch add .\` or \`latch init\` in project root |

**Stop hooks:** Cursor, Claude Code, Codex, Copilot CLI, Antigravity — installed by \`latch add\` / \`latch init\`.
**Latch MCP:** \`latch_room_brief\`, locks, chat history — installed into each agent's MCP config by \`latch add\`.

## Latch pseudo-commands (user chat)

These are **not** built-in slash commands. They are a **project convention** — phrases the user types so agents recognize Latch intent.

When the user sends any of these phrases (with or without a leading \`/\`), treat them as Latch instructions — not casual chat:

| User says | You do |
|-----------|--------|
| \`/latch update\` or \`latch update\` (or \`/relay update\`) | \`latch sync .\` → \`latch compile .\` → read \`.latch/compile_brief.md\` → update \`.latch/project.md\`, \`current_task.md\`, \`decisions.md\`, \`failures.md\` → \`latch context .\` → confirm "Latch updated." |
| \`/latch context\` or \`latch context\` (or \`/relay context\`) | Read \`.latch/latch_context.md\` (run \`latch context .\` first if stale). Summarize handoff briefly. |
| \`/latch ask\` or \`latch ask\` (or \`/relay ask\`) | Call Latch MCP tool **\`latch_room_brief\`** (or \`relay_room_brief\`, MCP server **\`latch\`**). Required on **Cursor, Claude Code, Codex, Copilot CLI, and Antigravity** — not a terminal command for the human. Summarize teammate chat, code edits, locks, and file-sync notes. Tell the user before you edit shared files. If \`latch\` MCP is missing, say so and suggest \`latch add .\` + agent restart (do not ask the user to run \`latch ask\`). |
| \`/latch init\` or \`latch init\` (or \`/relay init\`) | Run \`latch init\` in project root if \`.latch/\` missing; else confirm already installed. |

Use \`npx latch\` if the \`latch\` command is not on PATH. Do not ask the user to edit agent config files manually.

Cursor: \`@latch-sync\` skill at \`.cursor/skills/latch-sync/\`.
${LATCH_OS_END}
`;
}

function agentBootstrap(workspacePath) {
  const ws = workspacePath.replace(/\\/g, "/");
  return `# Latch agent bootstrap

Project: \`${ws}\`

## /latch ask (all agents)

When the user says **\`/latch ask\`** or **\`latch ask\`** (or **\`/relay ask\`**):

1. Call MCP tool **\`latch_room_brief\`** (or \`relay_room_brief\`) on the **\`latch\`** MCP server (stdio — installed by \`latch add\`).
2. Summarize peer chat, code edits, live locks, and the file-sync note for the user.
3. **Do not** tell the human to run a CLI command.

| Agent | Instructions file | Latch MCP config |
|-------|-------------------|------------------|
| **Cursor** | \`.cursor/rules/latch.mdc\`, \`.cursorrules\`, \`AGENTS.md\` | \`.cursor/mcp.json\` |
| **Claude Code** | \`CLAUDE.md\`, \`.claude/settings.json\` | \`.claude/settings.json\` → \`mcpServers.latch\` |
| **Codex** | \`AGENTS.md\` | \`.codex/config.toml\` → \`[mcp_servers.latch]\` |
| **Copilot CLI** | \`.github/copilot-instructions.md\` | \`.github/mcp.json\` |
| **Antigravity** | \`AGENTS.md\` | \`.agents/mcp_config.json\` |

If \`latch_room_brief\` is not in your tool list, Latch MCP is not connected — run \`latch add .\` from the repo root and restart this agent session.

## Other pseudo-commands

See the \`latch-os\` block in \`AGENTS.md\` / \`CLAUDE.md\` for \`/latch update\`, \`/latch context\`, and \`/latch init\`.
`;
}

module.exports = {
  LATCH_OS_BEGIN,
  LATCH_OS_END,
  RELAY_OS_BEGIN,
  RELAY_OS_END,
  latchOsBlock,
  relayOsBlock: latchOsBlock,
  agentBootstrap
};
