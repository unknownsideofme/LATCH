# CLI reference

`latch <command> [args]`. With no command, or with `help`, `-h` or `--help`, the usage
summary is printed.

Every command below also works as `npm run latch -- <command>` from the repository root,
or as `npx latch <command>`.

---

## Identity

### `latch login`

Signs in with GitHub.

Tries the [`gh` CLI](https://cli.github.com) first. If that fails and `GITHUB_CLIENT_ID`
is set, falls back to the OAuth device flow, printing a verification URL and a user code
and then polling until you authorize.

```
signed in as Ana Ruiz (@ana) via GitHub CLI
```

If neither path is available it exits non-zero and tells you to install the `gh` CLI, or
to set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` and use **Continue with GitHub** in
Mission Control.

### `latch whoami`

Prints the signed-in user and the selected project. Exits **1** with
`not signed in — run latch login` when there is no session.

```
Ana Ruiz (@ana)
project prj_9c1f2a
```

### `latch logout`

Clears the local session. Always exits 0.

---

## Attaching repositories

### `latch clone <url> [dir]`

`git clone`, then register the checkout as a project, then install hooks, MCP config and
the latch-os instruction block.

```
cloned https://github.com/you/repo.git
workspace /home/ana/repo
registered repo (prj_9c1f2a)
```

### `latch add <path> [name]`

Attaches a repository that is already on disk. Same registration and installation as
`clone`, without the network step.

```
added /home/ana/repo as repo
```

### `latch init [path]`

Wires hooks, the Latch MCP server and the `/latch ask` instructions for every supported
agent in `path` (default: the current directory), installs the **global** hook
configuration in your home directory, and registers the path as a project.

Exits **1** if the path does not exist.

```
Latch initialized in /home/ana/repo
Hooks + MCP wired for Cursor, Claude Code, Codex, Copilot CLI, Antigravity.
Run `latch serve`, then say `/latch ask` in any agent — it calls MCP latch_room_brief.
```

See [Installation → What gets written](./INSTALLATION.md#what-gets-written) for the full
file list.

---

## Running

### `latch serve [--port N] [--no-ui]`

Starts the API server, the coordinator and — unless `--no-ui` is given — Mission Control.

| Flag | Effect |
|---|---|
| `--port N` | API port. Defaults to `LATCH_PORT`, then 3001. |
| `--no-ui` | Skip Mission Control; run API and coordinator only. |

Mission Control's port comes from `LATCH_UI_PORT` (default 3002) and is passed to the
child `next dev` process along with `NEXT_PUBLIC_LATCH_API` pointing at the API origin.
The UI is only started after `/api/health` answers, with a 30 s ceiling.

`latch serve` supervises both children: `SIGINT` or `SIGTERM` tears down the whole tree
(via `taskkill /t /f` on Windows), and if either child exits, the other is stopped too.

If Mission Control's dependencies are missing it prints
`Mission Control is not installed — run npm install` and exits 1. If the API never becomes
ready it prints `[latch] API did not become ready on <origin>` and exits 1. If the API
port is already bound, the API process reports the conflict and exits without touching the
running instance's coordinator state.

### `latch status`

Pretty-prints `GET /api/health` — version, coordinator port, whether a user is signed in,
and the public room view (role, url, host project). Exits **1** with
`offline — run latch serve` when the API is unreachable.

---

## Sharing work

### `latch push`

`POST /api/push`. Computes a patch for every dirty working-tree file and fans it out to
the room.

```
push 3 file(s)
  src/auth.ts
  src/routes.ts
  package.json
```

Prints `push: nothing to push` when the tree is clean.

### `latch pull`

`POST /api/pull`. Fetches the host's dirty files and applies them to this clone. Prints
the files applied, or `pull: nothing to pull`.

Requires a room — without one the API answers `not_in_a_room` and the CLI prints the hint
and exits 1. On a host it is a no-op: the host already holds the working tree.

Both commands print the API's `hint` or `error` and exit **1** on failure, and
`offline — run latch serve` if the API cannot be reached. Note that both target
`127.0.0.1:3001` directly and do not honour `--port` or `LATCH_PORT`.

---

## MCP

### `latch mcp-url`

Prints a ready-to-paste `mcpServers` block for this room's shared-context endpoint:

```json
{
  "mcpServers": {
    "latch-room": {
      "type": "http",
      "url": "https://<tunnel>.ngrok-free.app/mcp",
      "headers": {
        "ngrok-skip-browser-warning": "latch",
        "x-latch-room-token": "rlm_…"
      }
    }
  }
}
```

The endpoint is **read-only** for anyone off the host machine — it exposes the room's chat
history, recent edits, locks and conflicts to any MCP client, including one on a machine
with no Latch installed. Locks and every other write stay on each member's own latch.

Exits **1** when this machine is not in a room, and notes that locally your agents already
reach Latch over stdio with nothing to configure. Warns if you are a guest with no member
token on file.

---

## Diagnostics

### `latch doctor`

Walks the exact chain the Coordinator board depends on and names the broken link.

This exists because locks and the board are different subsystems: a hook claims straight
against the host over HTTP, while the board is fed by the lock mirror and SSE. "Locking
works but I see nothing" is a normal — and otherwise invisible — way for Latch to fail.

Checks, in order:

1. Local API answers on `127.0.0.1:<LATCH_PORT>`. If not, it stops here and exits 1.
2. A room is joined, and with what role and URL.
3. **Guest only:** `room.json` carries a `hostProjectId`. Without it the lock mirror never
   starts, so the board stays empty even while locks work.
4. **Guest only:** the host answers `/api/health` through the tunnel.
5. **Guest only:** the host answers `/api/locks` for the shared project, and how many
   locks it reports.
6. This machine mirrors those locks. Because the mirror polls on its own clock, this is
   retried for up to four seconds before anything is called broken.

It finishes by printing what the board would render, split into locks mirrored from the
room and locks claimed on this machine.

Run it **on the machine that sees nothing**.

See [Troubleshooting](./TROUBLESHOOTING.md) for what to do with each result.

---

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Not signed in, offline, path not found, unknown command, or a failed API call |

Unhandled errors print `err.message` and exit 1.
