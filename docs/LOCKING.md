# Locking

The lock table is `backend/coordinator/lockTable.js`. This document describes what it
does, in the order you are likely to need it.

---

## Keys and namespacing

Every entry is keyed by:

```
<normalized workspace path>::<repo-relative posix file path>
```

Workspace roots are resolved through symlinks and compared case-insensitively on
Windows. File paths are normalized to workspace-relative POSIX paths, resolved through
existing symlinks, and rejected if they escape the canonical workspace.

The lock **file** on disk is named `sha256(<normalized workspace>::<file>)[:16] + ".lock"`
and lives in `<repo>/.latch/locks/`, falling back to a hashed subdirectory of
`~/.latch/locks/` when the repository's own directory cannot be created. A neighboring
`.fence` file preserves the last generation across release and coordinator restarts.

Because the key includes the workspace path, cross-machine locking only works if both
sides use the *same* path. Latch guarantees that by rewriting a guest's `workspaceId` to
the host's `hostWorkspacePath` — in `coordinator/client.js` on the way out, and again on
the host for any request that carries a member token or arrives from a remote address.

---

## Timings

| Constant | Value | Meaning |
|---|---|---|
| `DEFAULT_TTL_MS` | 15 s | Requested by the pre-tool hook |
| `MIN_TTL_MS` | 5 s | Requested TTLs are clamped up to this |
| `MAX_TTL_MS` | 300 s | Requested TTLs are clamped down to this |
| `CLEANUP_MS` | 5 s | Sweep interval for expired locks |
| `MAX_HOOK_KEEP_ALIVE_MS` | 300 s | Maximum background renewal window for a pre-tool lease |
| `RECENT_TTL_MS` | 45 s | How long a released lock stays on the board |
| `RECENT_MAX` | 200 | Released-lock ring buffer size |
| `READ_TTL_MS` | 30 s | How long a read stays on the board |
| `READ_MAX` | 300 | Read ring buffer size — a repo-wide grep cannot flood it |
| `WAITER_TTL_MS` | 5 min | How long a refused agent stays interested in the file |

A lock is alive while `now < (lastHeartbeat || claimedAt) + ttlMs`.
Write hooks request active renewal: the local lock sweeper or Supabase adapter
heartbeats the lease until the post-tool release or the five-minute cap. If the
post-tool hook never runs, renewal stops at that cap and the lock expires after
its normal TTL.

---

## Ownership

Agent IDs are `label:host:session`. `sameOwner(a, b)` is true when:

- the strings are identical, **or**
- the hosts match **and** both sides name a real session (not empty, not `local`) **and**
  those sessions are equal, **or**
- the hosts match, at least one session is unknown, **and** the labels are equal.

The session-first rule exists because label-only matching was wrong in both directions.
One editor firing two hook configurations claims as `Cursor:host:sid` and again as
`Claude Code:host:sid` and would deadlock against itself; two concurrent turns of the same
product are `Antigravity:host:A` and `Antigravity:host:B` and would be treated as one
owner, silently sharing the file.

For remote members the host appends `@<login>` to the agent ID and overwrites
`holder.login` with the authenticated login. A member therefore cannot forge another
member's identity and cannot release their locks.

Each write grant also receives a cryptographically random ownership token and a
monotonically increasing fencing token. Renewal and release require both values; they
are persisted privately under `~/.latch/leases` so separate pre-tool and post-tool hook
processes can complete the same lease. Lock listings expose fencing generations but
never expose ownership tokens.

---

## Claiming

`claim({ agentId, file, files, ttl, workspaceId, holder, source, dependsOn, mode, leases })`

**Batch claims.** When `files` is a non-empty array, the entries are deduplicated and
sorted, then claimed one at a time in the coordinator's synchronous critical section.
Sorting gives every agent the same acquisition order. If any file in the batch is refused,
newly acquired locks are rolled back while leases the requester already held are
preserved.

**Preconditions.** A workspace path containing a separator is required — locks are always
per-repository — as are `agentId` and a non-empty file path.

**Read mode.** `mode: "read"` is never a lock. It is recorded via `noteRead` and always
returns `{ allowed: true, reading: true }`, even while someone else holds the write lock.

**Write mode**, in order:

1. An existing entry that is no longer alive is unpersisted and dropped.
2. If the same owner already holds a **write** lock, it is renewed only when its ownership
   and fencing tokens match. The lease timestamp and TTL are refreshed.
3. If the existing entry is a **read**, it is discarded. Readers never block a writer —
   an agent that merely looked at a file has nothing to lose if someone else edits it, and
   denying the edit meant one agent browsing the repo could stall everyone.
4. If a live write lock is held by a different owner, the claim is refused with the
   holder's label, the refusing agent is recorded as a waiter for that file, and the API
   answers **409**.
5. Otherwise the entry is created with a new ownership token and fencing generation,
   persisted to disk, and a `change` event is emitted.

A denial uses `status: "DENIED"` and `code: "FILE_LOCKED"` and includes the canonical
path, owner, expiry countdown, and current fencing token. If no shared coordinator can
adjudicate a write, the hook denies it with `COORDINATOR_UNAVAILABLE`.

**Dependency warnings.** Any `dependsOn` entry currently held for writing by a different
owner produces a `warning` string on an otherwise successful claim. This never blocks.

---

## Releasing

`release({ agentId, file, workspaceId, ownershipToken, fencingToken })`

- A **read** entry removes the caller from the reader set, and the entry itself only when
  the set empties.
- A **write** entry can only be released with its current ownership and fencing tokens;
  mismatched or stale credentials return `{ ok: false, reason: "not_holder" }`.
- Otherwise the entry is deleted from memory and disk, remembered in the released-locks
  buffer, and a `change` event is emitted.

`releaseAll(agentId, workspaceId, leases)` releases only entries for which the stop hook
supplies matching credentials. The stop hook gathers these from the private local lease
store.

Locks also disappear on their own: `sweepExpired()` runs every 5 s, re-scans tracked
workspaces so persisted locks surface, and deletes anything past its TTL.

---

## Reads, waiters and released locks

None of these three arbitrate anything. They exist so the board tells the truth.

**Reads** are recorded by the pre-read hook via `POST /api/coord/read`. They show the whole
room's attention rather than only the handful of files being written. They decay after
30 s and are capped at 300 entries.

**Waiters** are recorded when a claim is refused. They name exactly the agents that most
need the file's new content the moment the holder is done, and are used to target patch
delivery. They expire after five minutes.

**Released locks** stay listed for 45 s with `released: true` and a `releasedAt`
timestamp. They are display-only: `getLock()` — and therefore every arbitration path —
never sees them.

---

## Dependency-graph locking

Files do not exist independently. `backend/lib/depGraph.js` answers *"does this change
affect files another agent is working on?"* rather than only *"is this exact file
locked?"*.

### Building the graph

The workspace is walked, skipping `node_modules`, `.git`, `.next`, `out`, `dist`,
`coverage`, `.latch` and any dot-directory. Files with these extensions are parsed:

`.ts .tsx .js .jsx .mjs .cjs .py .go .rs .java .cs .cpp .cc .cxx .h .hpp .php .rb`

Import specifiers are extracted with tree-sitter (`@vscode/tree-sitter-wasm`), then
resolved against the tree with per-language rules — relative paths for JS/TS, dotted
module paths for Python/Java/C#, `super::` and sibling modules for Rust, path-like requires
for PHP and Ruby, relative package paths for Go. Unresolved relative imports are recorded
as `unresolvable` with reason `missing`; dynamic imports are recorded with reason
`dynamic`.

Cycles are found with Tarjan's strongly-connected-components algorithm. A cycle is treated
as **one lock unit**.

### Overrides

Drop a `.latch/deps.json` into the repository:

```json
{
  "lockDepth": 2,
  "edges": [["src/api/routes.ts", "src/db/schema.ts"]]
}
```

- `lockDepth` — how many hops out from the edited file to consider. Default 1. Also
  settable with `LATCH_LOCK_DEPTH`; the file wins.
- `edges` — extra `[from, to]` dependencies the parser cannot see (generated code,
  runtime wiring, config-driven imports).

### Soft blocks

`softBlock()` reports a problem when either:

- another file in the same strongly-connected component is held by a different owner, or
- any dependency within `lockDepth` hops is held by a different owner.

A soft block produces a `warning` on the claim, not a refusal. The agent is told which
file, who holds it, and that proceeding may cause inconsistencies. The blast radius stays
visible; the agents stay parallel.

A held lock only counts if it is alive — an expired entry is ignored, and a lock held by
the claiming agent itself is never a block.

### The graph on the board

`GET /api/projects/:id/graph` returns a snapshot focused on what matters: every locked
file, everything one hop from it in either direction, every member of its cycle, plus the
48 highest-degree nodes so the picture is not empty on a quiet repo. The payload carries
`lockDepth`, `engine`, `languages`, `fileCount`, `edgeCount`, `cycles`, `unresolvable`
(capped at 40) and per-node `imports`, `dependents`, `cyclic` and `locked` flags.

---

## Collision counters

Every prevented collision is counted, persisted to
`~/.latch/data/projects/<id>/collisions.json`, and mirrored to `<repo>/.latch/collisions.json`.

| Counter | Incremented when |
|---|---|
| `claimsBlocked` | A claim was refused because someone else held the file |
| `patchesBlocked` | A patch was withheld because of a peer clash |
| `patchesSkipped` | A patch was dropped as redundant |
| `patchesDeferred` | A patch was buffered awaiting its Lamport predecessor |
| `mergesFlagged` | A pairwise transform needed manual resolution |

`totalSaved` is the sum of `claimsBlocked`, `patchesBlocked`, `patchesSkipped` and
`mergesFlagged` — `patchesDeferred` is tracked but not counted as a save, since a deferred
patch is expected to arrive. The last 40 events are kept in `recent`.

In a room the counters merge across every peer snapshot, and the merged result carries
`scope: "room"`, a `byMember` breakdown and `peerLogins`. Solo, the scope is `"solo"`.
Read them with the MCP tool `latch_get_collision_stats`.
