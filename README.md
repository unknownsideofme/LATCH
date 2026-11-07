<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./latch-logo-white.png">
    <source media="(prefers-color-scheme: light)" srcset="./latch-logo.png">
    <img src="./latch-logo-white.png" alt="Latch Logo" width="280" />
  </picture>
</p>

<p align="center">
  <strong>The coordination layer for machine-speed coders.</strong><br />
  Prevent concurrent agent clobbers, bound AST blast radiuses, and synchronize distributed AI coding swarms in real time.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.4-emerald?style=flat-square" alt="Version 2.4" />
  <img src="https://img.shields.io/badge/agents-Claude%20%7C%20Cursor%20%7C%20Antigravity%20%7C%20Copilot-blue?style=flat-square" alt="Supported Agents" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License MIT" />
</p>

---

## Overview

AI coding agents (Claude Code, Cursor, Copilot Workspace, Codex, and Antigravity) write code at machine speed. When multiple agents or developers edit the same codebase simultaneously, they have **zero awareness of each other**. They overwrite concurrent work, break downstream interfaces, and cause catastrophic git merge conflicts.

**Latch** sits between your AI coding agents and your local filesystem. It wraps your workspace in an atomic lock arbiter, tracks module blast radiuses using concrete AST parsing, and streams working-tree patches across machines before code ever hits git.

```
       WITHOUT LATCH                               WITH LATCH
 12 Agents · Blind Writers             12 Agents · 1 Coordination Bus
Conflicts discovered at merge         Conflicts prevented before write lands

   Agent A ──┐ (blind edit)               Agent A ──┐
             ├──► File Overwrite                    ├──► [ LATCH ARBITER ]
   Agent B ──┘ (silent clobber)           Agent B ──┘    ├── AST Guard
                                                         ├── Mutex Lease
                                                         └── Patch Sync
```

---

## The Problem: Why Autonomous Agent Swarms Break

Git was designed for human developers committing minutes or hours apart. AI agents work in seconds:

1. **No Filesystem Mutexes**: Multiple agents write to the same files concurrently without file lock arbitration, clobbering each other's edits mid-stream.
2. **Hidden AST Blast Radiuses**: An agent modifying an authentication signature in `auth.ts` doesn't know that another agent is simultaneously updating `routes.ts` which depends on that signature.
3. **Drift Across Machines**: When teammates run parallel agents on separate laptops, their uncommitted working trees diverge rapidly, leading to merge hell.
4. **Agent Hallucinations from Dirty State**: When an agent reads half-written or clobbered files, its context window ingests corrupted state and generates invalid code.

---

## How Latch Works

Latch operates purely on your local machine and peer-to-peer over tunnels. It requires no centralized database, cloud backend, or third-party servers.

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           LATCH LOCAL DAEMON                           │
  │                             ( Web Socket )                             │
  │                                                                        │
  │   ┌─────────────────────┐   ┌──────────────────┐   ┌───────────────┐   │
  │   │  TTL Mutex Engine   │   │ AST Blast Radius │   │  Vector Clock │   │
  │   │  (Atomic Leases)    │   │  (Tree-sitter)   │   │   Patch Bus   │   │
  │   └──────────▲──────────┘   └────────▲─────────┘   └───────▲───────┘   │
  └──────────────┼───────────────────────┼─────────────────────┼───────────┘
                 │ (Pre-tool claim)      │ (Import scan)       │ (Post-tool)
  ┌──────────────┴───────────────────────┴─────────────────────┴───────────┐
  │                            AGENT ECOSYSTEM                             │
  │  Claude Code CLI  │  Cursor IDE  │  Copilot  │  Codex  │  Antigravity   │
  └────────────────────────────────────────────────────────────────────────┘
```

### 1. Sub-Millisecond Exclusive File Mutex Leases
Whenever an agent invokes a file modification tool (`Write`, `Edit`, `apply_patch`), Latch intercepts the intent via a pre-tool hook.
- If the file is **unlocked**, Latch grants an exclusive lease and assigns a time-to-live (TTL, default 30s) renewed by periodic heartbeats.
- If another agent or user holds the lock, the write is **instantly rejected** before touching disk, reporting the exact holder identity.
- When an agent finishes or crashes, the lease expires cleanly, preventing permanent deadlocks.

### 2. AST Dependency Blast-Radius Bounding
Path-exact locking is not enough. Modifying a shared interface breaks all files that import it. Latch parses the codebase using **Tree-sitter** grammar parsers across:
- **TypeScript & JavaScript** (ESM & CommonJS imports)
- **Rust, Go, C, & C++**
- **Python, PHP, & Ruby**
- **Java & C#**

When Agent A claims `src/auth/session.ts`, Latch calculates its downstream dependent graph (e.g., `src/api/routes.ts`, `src/middleware/auth.ts`). If Agent B tries to touch any file within that blast radius, Latch rejects the write with an AST boundary collision notice.

### 3. Non-Invasive Stop Hook Interception
Latch does not require modifying agent binaries or installing proprietary editor plugins. It configures the standard native hook protocols of each supported agent:
- Pre-tool hook: claims mutex and validates blast radius.
- Post-tool hook: releases mutex and broadcasts the patch.
- Pre-read hook: ensures clean, synchronized state before an agent reads files.
- Stop hook: gracefully clears leases when an agent session ends.

### 4. Host–Guest Room Topology
- **Host**: Exactly one machine per team workspace runs `latch serve`. It owns the canonical lock table.
- **Guest**: Teammates run their own local Latch daemon. When they connect to a host room via an ngrok tunnel, lock requests are verified across the tunnel while keeping disk operations strictly local.

### 5. Causal Working-Tree Patch Sync
Latch does not push or pull git commits. It synchronizes the **dirty working tree** across team members using reverse unified diffs:
- `latch push`: Bundles dirty working-tree edits and broadcasts them to the room.
- `latch pull`: Applies remote working-tree changes without requiring git commit or branch switching.

### 6. Shared Memory & MCP Context Engine
Latch runs a Model Context Protocol (MCP) server. Connected agents share:
- Live lock tables and conflict alerts.
- Cross-agent unified transcript history.
- Shared architectural decisions and active task tracking.

---

## Installation

### System Requirements
| Component | Requirement | Notes |
| :--- | :--- | :--- |
| **Node.js** | Node.js 18+ (20+ recommended) | Runs the daemon and CLI |
| **npm** | npm 9+ | CLI package management |
| **Git** | Any modern version | Required for `latch clone` |
| **GitHub CLI** | `gh` CLI (Optional) | Simplifies zero-config authentication |
| **ngrok** | Optional | Only needed for cross-machine room sharing |
| **Database** | **None** | No PostgreSQL, Redis, or cloud DB required |

### Installing the CLI

```bash
# 1. Install the latch cli 
npm i -g latch-it

# 2. Check whether it is installed 
latch --version 

#3. login using your github
latch login  #follow the prompts 

```

## Quickstart: Getting Started in 3 Minutes

### Mode A: Room Host (Starting a Swarm)

Follow these 4 steps on the host machine:

#### Step 1: Sign In with GitHub
```bash
latch login
```
*Locks will be attributed to your GitHub handle (e.g., `@developer`) so team members know who holds each file.*

#### Step 2: Register a Repository
If cloning a new repository:
```bash
latch clone https://github.com/your-org/your-repo.git
cd your-repo
```
If you already have the repository on your disk:
```bash
latch add /path/to/existing-repo
cd /path/to/existing-repo
```
*This registers the repository and writes hook configurations for Claude Code, Cursor, Copilot, Codex, and Antigravity automatically.*

#### Step 3: Start the Coordination Daemon
```bash
latch serve
```
*Starts the local API daemon on `http://127.0.0.1:3001` and opens Mission Control on `http://localhost:3002`.*

#### Step 4: Share the Room
In Mission Control (`http://localhost:3002`), navigate to **Team → Share**. Latch generates an encrypted invite link with an embedded room token to share with teammates.

---

### Mode B: Teammate / Guest (Joining a Swarm)

Teammates keep their own files and run their own agents locally:

```bash
# 1. Authenticate identity
latch login

# 2. Clone the repository locally
latch clone https://github.com/your-org/your-repo.git
cd your-repo

# 3. Start your local Latch daemon
latch serve

# 4. Connect to the host's room
# In Mission Control (http://localhost:3002) → Team → Join → Paste host invite link

# 5. Pull the host's live uncommitted state
latch pull
```

---

### Testing Your First Coordinated Write

1. Open your terminal or IDE agent (e.g. Claude Code or Cursor).
2. Prompt the agent to refactor a file (e.g. `src/auth.ts`).
3. Check the active locks in another terminal:
   ```bash
   latch status
   ```
4. Observe that the lock table lists `src/auth.ts` as exclusively held by your agent.
5. If a second agent attempts to edit `src/auth.ts` concurrently, Latch refuses the write with:
   ```text
   [Latch Error] Lock rejected: src/auth.ts is currently held by @developer (agent: claude).
   Lease expires in 18s.
   ```

---

## Supported Agents & Hook Protocol

Latch hooks into agents at the config layer. When you run `latch clone` or `latch add`, the following hook files are created:

| Agent | Config File | Intercepted Tools |
| :--- | :--- | :--- |
| **Claude Code** | `.claude/settings.json` | `Edit`, `Write`, `NotebookEdit` |
| **Cursor IDE** | `.cursor/hooks.json` | `Write`, `Edit`, `Delete` |
| **Codex** | `.codex/hooks.json` | `apply_patch`, `Edit`, `Write` |
| **GitHub Copilot CLI** | `.github/hooks/latch-os.json` | `edit`, `create` |
| **Antigravity** | `.agents/hooks.json` | `write_to_file`, `replace_file_content`, `multi_replace_file_content` |

Hook files can be safely committed to source control so every contributor inherits the coordination layer automatically.

---

## CLI Reference

### Identity Commands

#### `latch login`
Sign in with your GitHub identity. Uses your existing `gh` CLI credentials, or falls back to device flow if `GITHUB_CLIENT_ID` is set.
```bash
latch login
```

#### `latch whoami`
Displays the currently signed-in GitHub username and active project id.
```bash
latch whoami
```

#### `latch logout`
Clears local session tokens without affecting your underlying `gh` CLI setup.
```bash
latch logout
```

---

### Workspace Management

#### `latch clone <url> [dir]`
Performs a `git clone`, registers the workspace with Latch, and installs agent hooks in a single command.
```bash
latch clone https://github.com/org/repo.git ./my-repo
```

#### `latch add <path>`
Registers an existing local folder as a Latch workspace and installs agent hooks without touching git history.
```bash
latch add ~/projects/my-app
```

---

### Daemon & Server

#### `latch serve`
Boots the background API daemon and Mission Control dashboard.
```bash
latch serve              # API on :3001, Mission Control on :3002
latch serve --no-ui      # Headless mode: API daemon only
latch serve --port 4001  # Custom daemon port
```

#### `latch status`
Health check printing daemon connectivity, room role (`host` or `guest`), and port status as JSON.
```bash
latch status
```

---

### Causal Patch Sync

#### `latch push`
Bundles all uncommitted working-tree modifications and broadcasts them to the active room.
```bash
latch push
```

#### `latch pull`
Pulls and applies the latest uncommitted working-tree changes broadcast by the room host onto your local workspace.
```bash
latch pull
```

---

### Diagnostics & MCP

#### `latch doctor`
Diagnoses room connectivity, daemon health, hook registrations, and lock table mirrors.
```bash
latch doctor
```

#### `latch mcp-url`
Outputs ready-to-paste JSON configuration for connecting MCP-compatible tools to the room's live context server.
```bash
latch mcp-url
```

---

## Using Mission Control Dashboard

When running `latch serve`, open **`http://localhost:3002`** to access Mission Control:

```
┌────────────────────────────────────────────────────────────────────────┐
│  ☰ [Flower Icon] latch.it v2.4       ● Daemon :3001     [+ New Project]│
├────────────────────────────────────────────────────────────────────────┤
│  All Projects                                                          │
│  [ Filter projects...                       ]  [ Status: All ▾ ]       │
├────────────────────────────────────────────────────────────────────────┤
│  ▼ Active Workspaces (3 Active)                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [Git] backend-api  ● ACTIVE SWARM          4 Coders  :3001 Live  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ▼ Failed / Blocked Workspaces (1 Blocked)                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [X] auth-service   ● FAILED / BLOCKED      Conflict  :3001 Live  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Lock Leases Table**: Real-time table of all active file locks, owning agent, and countdown TTL timer.
- **AST Blast-Radius Visualizer**: Interactive module boundary graph showing which downstream files are protected.
- **Causal Event Stream**: Real-time chronological audit log of file claims, releases, and patch broadcasts.
- **Unified Agent Chat**: Aggregated transcript history across all agents running on any connected machine.
- **Room Sharing & Presence**: Invite links, member tokens, and peer latency status.

---

## Using the MCP Context Server

Any MCP-compatible client (Claude Desktop, Cursor, Antigravity, OpenCode) can connect to Latch to query lock state, read transcripts, or append decisions.

### 1. Retrieve Configuration
Run inside your workspace:
```bash
latch mcp-url
```

### 2. Configure Your MCP Client
Add the emitted config to your agent's MCP settings (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "latch-room": {
      "type": "http",
      "url": "https://<your-ngrok-tunnel>.ngrok-free.app/mcp",
      "headers": {
        "ngrok-skip-browser-warning": "latch",
        "x-latch-room-token": "rmt_your_room_token"
      }
    }
  }
}
```

### 3. Exposed MCP Tools
- `latch_claim_file`: Acquire an exclusive lock on a file before editing.
- `latch_release_file`: Release a held lock after completing an edit.
- `latch_status`: Inspect all active locks and blast radiuses across the room.
- `latch_get_conflicts`: Query contested edits or AST collisions in the last 5 minutes.
- `latch_get_recent_changes`: Retrieve real-time `code_edit` event stream.
- `latch_report_decision` / `latch_get_decisions`: Coordinate architecture choices across swarms.
- `latch_update_task` / `latch_get_active_tasks`: Synchronize swarm task backlog.
- `latch_get_chat_history`: Access unified transcripts from other connected agents.

---

## Configuration & Environment Variables

Configure Latch via environment variables in your shell or `.env.local`:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `LATCH_PORT` | `3001` | Local coordination API daemon port |
| `LATCH_UI_PORT` | `3002` | Mission Control web dashboard port |
| `LATCH_UI_ORIGIN` | `http://localhost:3002` | Allowed CORS origin for dashboard requests |
| `GITHUB_CLIENT_ID` | *Optional* | GitHub OAuth app ID for device-flow authentication |
| `GITHUB_CLIENT_SECRET` | *Optional* | GitHub OAuth secret for hosted login gates |
| `DEBUG` | `false` | Enable verbose debug logging for AST graph parsing |

---

## Troubleshooting & Diagnostics

### Run the Diagnostic Suite
If something looks out of sync, run `latch doctor` on the affected machine:
```bash
latch doctor
```
It tests:
1. Local daemon liveness on `127.0.0.1:3001`.
2. Room configuration and role integrity (`host` vs. `guest`).
3. Reachability of the host through the ngrok tunnel.
4. Active lock mirroring and hook file presence.

### Common Issues and Resolutions

#### 1. `offline — run latch serve`
- **Cause**: No daemon process is responding on port `3001`.
- **Fix**: Run `latch serve` in a terminal window, or check if another process is occupying port `3001` using `lsof -i :3001`.

#### 2. The Board is Empty but Agent Locking Works
- **Cause**: Hooks call the daemon API directly over HTTP, whereas the dashboard is updated by the lock mirror.
- **Fix**: Restart `latch serve` on your machine to refresh the SSE stream.

#### 3. Agent Edits Without Claiming Locks
- **Cause**: The workspace was cloned using raw `git clone` instead of `latch clone`, so hooks were not written.
- **Fix**: Run `latch add .` inside the repository root to install hooks for all agents.

#### 4. `cannot reach the host` (Guests)
- **Cause**: The host machine closed their laptop, restarted the daemon, or the ngrok tunnel URL refreshed.
- **Fix**: Have the host copy the updated invite link from Mission Control (**Team → Share**) and re-join with `latch pull`.

---

## Frequently Asked Questions (FAQ)

#### Does Latch replace Git?
**No.** Git coordinates human commits over hours and days. Latch coordinates autonomous AI agents editing the same files **right now in real time**. You still branch, commit, review pull requests, and merge as normal.

#### What happens if an agent crashes while holding a lock?
Locks use time-to-live leases (default 30 seconds). If an agent crashes, exits, or is terminated, its heartbeat stops and Latch **auto-releases the lock**, preventing stale deadlocks.

#### Does Latch upload my code or prompts to a cloud server?
**No.** Latch is completely self-hosted on your machine. All file parsing, AST generation, and lock tables live in memory on your host laptop. If you share a room across machines, patches stream directly peer-to-peer over an encrypted tunnel.

#### Can I use Latch with solo development?
**Yes.** Even for a single developer, running Claude Code in the terminal while editing in Cursor IDE frequently results in race conditions. Latch coordinates your local terminal agents and IDE agents seamlessly.

---

## License

Distributed under the MIT License. See `LICENSE` for details.
