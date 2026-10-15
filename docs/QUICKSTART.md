# Quickstart

Five minutes from a clean checkout to agents that cannot silently overwrite each other.

**Prerequisites:** Node.js 20 or newer and npm. Nothing else is required
for solo use — no database, no hosted backend, no account.

---

## 1. Install the CLI

From a clone of this repository:

```bash
npm install
npm link
```

`npm link` puts `latch` on your `PATH`. Verify it:

```bash
latch help
```

If you would rather not link globally, every command below also works as
`npm run latch -- <command>` from the repository root, or as `npx latch <command>`.

---

## 2. Attach a repository

Pick one. Both register the repository as a Latch *project* and install hooks, MCP config
and the latch-os instruction block into every supported agent surface.

```bash
# You already have the repo checked out
latch add /path/to/repo

# You do not have it yet
latch clone https://github.com/you/repo.git

# You are already inside the repo
latch init
```

What this writes into the repository is listed in
[Installation → What gets written](./INSTALLATION.md#what-gets-written). Nothing is
committed for you; review and commit or ignore as you prefer.

---

## 3. Sign in (optional, but do it)

```bash
latch login
```

This reads your identity from the [GitHub CLI](https://cli.github.com) (`gh auth login`).
Identity is what puts a name — rather than a bare hostname — next to a lock on the board,
and it is required before you can host or join a room.

Without the `gh` CLI you can set `GITHUB_CLIENT_ID` and use the OAuth device flow, or set
`GITHUB_CLIENT_ID` plus `GITHUB_CLIENT_SECRET` and use **Continue with GitHub** in Mission
Control.

---

## 4. Start the server

```bash
latch serve
```

Three things come up:

| | Address |
|---|---|
| API | `http://127.0.0.1:3001` |
| Mission Control | `http://localhost:3002` |
| Coordinator | `127.0.0.1:<ephemeral>` (printed at startup) |

Use `latch serve --no-ui` to skip Mission Control and run the API and coordinator only.

Leave this running. It is the process that owns the lock table.

---

## 5. Start your agents as usual

Open Cursor, Claude Code, Codex, Copilot CLI or Antigravity in that repository and work
normally. There is no command to remember: the hooks installed in step 2 claim a lock
before each write tool runs and release it after.

Open `http://localhost:3002` and you will see claims appear as agents work.

To confirm the wiring end to end, ask any agent `/latch ask`. It calls the Latch MCP tool
`latch_room_brief` and reports back on locks, recent edits and teammate activity.

---

## 6. Bring in a teammate (optional)

The host — the person whose machine will hold the shared lock table:

```bash
latch serve
```

Then open Mission Control → **Team** → **Share**. Latch starts an ngrok tunnel and mints an
invite link addressed to one GitHub login.

The teammate:

```bash
latch serve            # their own local latch
# paste the host's invite link on the Team tab
latch pull             # take the host's current working state
```

From here both machines arbitrate against the host's lock table, and `latch push` /
`latch pull` move dirty working-tree files between them as patches.

Full details, including how invites and member tokens work, are in [Rooms and
teams](./ROOMS.md).

---

## Verifying it works

```bash
latch status     # health: room, role, host, ports
latch doctor     # walks the chain the board depends on and names the broken link
```

The most common surprise is a board that looks empty while locking is in fact working
correctly — locks and the board are separate subsystems. `latch doctor` distinguishes the
two. See [Troubleshooting](./TROUBLESHOOTING.md).

---

## Next steps

- [Concepts](./CONCEPTS.md) — the five words you need to read the rest of the docs.
- [Locking](./LOCKING.md) — what actually blocks an agent, and what only warns it.
- [CLI reference](./CLI.md) — every command in full.
