# Installation

---

## Requirements

| | |
|---|---|
| **Required** | Node.js 20+ (`package.json` declares `engines.node >= 20`), npm |
| **Bundled** | `express`, `cors`, `ws`, `@vscode/tree-sitter-wasm`; `next` and `react` for Mission Control |
| **Not needed** | MongoDB, Redis, Docker, a hosted backend, an account |
| **Optional** | [`gh` CLI](https://cli.github.com) for `latch login`; [ngrok](https://ngrok.com) for cross-machine rooms |

Latch stores everything in JSON files under `~/.latch` and `<repo>/.latch`. There is no
database and no migration step.

---

## Installing the CLI

### From this repository

```bash
git clone https://github.com/unknownsideofme/LATCH.git
cd latch
npm install
npm link
```

`npm link` registers the `latch` bin declared in `package.json` (`cli/latch.js`).

### Without linking

Both of these work from the repository root:

```bash
npm run latch -- <command>
npx latch <command>
```

Agent instruction files tell agents to fall back to `npx latch` when `latch` is not on
`PATH`.

---

## Attaching a repository

| Goal | Command |
|---|---|
| Repo already on disk | `latch add /path/to/repo [name]` |
| Repo not cloned yet | `latch clone <url> [dir]` |
| You are inside the repo | `latch init [path]` |

All three register the project and install hooks. `latch init` additionally installs the
**global** hook configuration (see below), so agents started outside a registered workspace
still reach Latch.

---

## What gets written

### Into the repository

| Path | Purpose |
|---|---|
| `.claude/settings.json` | Claude Code hooks **and** `mcpServers.latch` |
| `.cursor/hooks.json` | Cursor hooks (`preToolUse`, `postToolUse`, `beforeReadFile`, `stop`) |
| `.cursor/mcp.json` | Cursor MCP server entry |
| `.cursor/rules/latch.mdc` | Cursor always-apply rule carrying the latch-os block |
| `.codex/hooks.json` | Codex hooks |
| `.codex/config.toml` | Codex MCP server (`[mcp_servers.latch]`) |
| `.github/hooks/latch-os.json` | Copilot CLI hooks |
| `.github/mcp.json` | Copilot CLI MCP server (`type: "local"`, `tools: ["*"]`) |
| `.github/copilot-instructions.md` | latch-os instruction block |
| `.agents/hooks.json` | Antigravity hooks (keyed by hook name, `latch`) |
| `.agents/mcp_config.json` | Antigravity MCP server entry |
| `AGENTS.md`, `CLAUDE.md`, `.cursorrules` | latch-os instruction block |
| `.latch/AGENT_BOOTSTRAP.md` | The file every agent is told to read first |
| `.latch/room.json` | Room membership for this workspace, when in a room |
| `.latch/coordinator-state.json` | Live coordinator and API ports |
| `.latch/locks/*.lock` | On-disk lock files (also the fail-open fallback) |
| `.latch/collisions.json` | Human-readable mirror of the collision counters |
| `.latch/deps.json` | *Optional, yours to write* — dependency graph overrides |

The instruction block is delimited by `<!-- BEGIN:latch-os -->` / `<!-- END:latch-os -->`
markers and is replaced in place on reinstall, so your own content in `AGENTS.md` and
`CLAUDE.md` is preserved.

Consider adding `.latch/` to `.gitignore` if you do not want lock and room state in
version control. `collisions.json` is deliberately mirrored into the repo so the counter
is git-visible if you want it there.

### Into your home directory

Written by `latch init`, and also on every `latch serve` start (best-effort):

| Path | Purpose |
|---|---|
| `~/.latch/data/registry.json` | Projects and users |
| `~/.latch/data/session.json` | Signed-in user, selected project |
| `~/.latch/data/projects/<id>/memory.json` | Unified history, chats, edits, patches |
| `~/.latch/data/projects/<id>/collisions.json` | Authoritative collision counters |
| `~/.latch/room.json` | Room membership, machine-wide |
| `~/.latch/coordinator-state.json` | Coordinator and API ports |
| `~/.latch/locks/` | Lock files for workspaces whose own `.latch` is unwritable |
| `~/.latch/hook-debug.log` | Only when `LATCH_HOOK_DEBUG=1` |
| `~/.claude/settings.json` | Global Claude Code hooks + MCP (merged, not overwritten) |
| `~/.cursor/hooks.json`, `~/.cursor/mcp.json` | Global Cursor hooks + MCP |
| `~/.codex/hooks.json`, `~/.codex/config.toml` | Global Codex hooks + MCP |
| `~/.copilot/mcp-config.json` | Global Copilot MCP |
| `~/.gemini/config/hooks.json` | Global Antigravity hooks |
| `~/.gemini/config/plugins/latch/hooks.json` | Antigravity plugin-bundle hooks |

If a workspace's `.latch` directory cannot be created — a missing drive letter, an
unplugged disk, a host path from another OS — Latch falls back to a hashed subdirectory
under `~/.latch/locks/` rather than failing the claim.

---

## Signing in

```bash
latch login     # via the gh CLI
latch whoami
latch logout
```

`latch login` shells out to `gh` first. If that fails and `GITHUB_CLIENT_ID` is set, it
falls back to the OAuth device flow and prints a verification URL and code.

For browser sign-in from Mission Control, set both `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` and use **Continue with GitHub**; the callback is served at
`/api/auth/github/callback`.

Identity is not required to run Latch solo, but it is required to host or join a room, and
it is what puts a name rather than a hostname next to a lock.

---

## Running

```bash
latch serve            # API :3001, coordinator (ephemeral), Mission Control :3002
latch serve --no-ui    # API + coordinator only
latch serve --port 4001
```

For development on Latch itself, `package.json` also offers:

```bash
npm run dev       # API + Mission Control dev server, concurrently
npm run dev:api   # API only
npm run dev:ui    # Mission Control only
npm start         # node backend/server.js --port 3001
npm run coordinator   # standalone coordinator process
```

Mission Control is a Next.js app in `mission-control/` and is an npm workspace of the root
package, so a single `npm install` at the root installs it too. `latch serve` runs it with
`next dev`; if a static export exists at `mission-control/out`, the API server serves it
directly from `/`.

---

## Updating

Pull, reinstall dependencies, and re-run the installer so hook commands point at the new
paths:

```bash
git pull
npm install
latch init /path/to/repo
```

Hook commands are absolute paths into this repository's `hooks/` directory, so moving or
renaming the Latch checkout requires re-running `latch init`.

---

## Uninstalling

1. `npm unlink latch` (or `npm rm -g latch`).
2. Delete `.latch/` and the agent config files listed above from any repository you
   attached — or just delete the `hooks` and `mcpServers.latch` entries if you keep other
   configuration in those files.
3. Delete `~/.latch/` to remove all local state.
4. Remove the Latch entries from the global agent configs in your home directory.
