const {
  normWorkspace,
  normalizeFile,
  workspaceRoot,
  belongsTo,
  lockKey,
} = require("./LockUtils");
const {
  RECENT_MAX,
  RECENT_TTL_MS,
  READ_MAX,
  READ_TTL_MS,
  WAITER_TTL_MS,
} = require("./LockConstants");

class ObservationTracker {
  constructor() {
    this.recent = new Map();
    this.reads = new Map();
    this.waiters = new Map();
  }

  remember(entry) {
    if (!entry?.filePath) return;
    this.recent.set(lockKey(entry.workspaceId, entry.filePath), {
      ...entry,
      readers: [...(entry.readers || [])],
      releasedAt: entry.releasedAt || Date.now(),
    });
    if (this.recent.size > RECENT_MAX) {
      this.recent.delete(this.recent.keys().next().value);
    }
  }

  recentFor(keys, activeLocks, now = Date.now(), publicMapper = (e) => e) {
    const out = [];
    for (const [key, entry] of this.recent) {
      if (now - entry.releasedAt > RECENT_TTL_MS) {
        this.recent.delete(key);
        continue;
      }
      if (activeLocks && activeLocks.has(key)) continue;
      if (keys && !belongsTo(entry, keys)) continue;
      out.push({
        ...publicMapper(entry),
        released: true,
        releasedAt: entry.releasedAt,
      });
    }
    return out;
  }

  noteRead({ agentId, filePath, workspaceId, holder }) {
    const file = normalizeFile(filePath);
    const ws = workspaceRoot(workspaceId) || workspaceId;
    if (!file || !agentId || !ws) return null;
    const key = `${normWorkspace(ws)}::${file}::${agentId}`;
    const entry = { filePath: file, agentId, workspaceId: ws, holder: holder || null, at: Date.now() };
    this.reads.delete(key);
    this.reads.set(key, entry);
    if (this.reads.size > READ_MAX) {
      this.reads.delete(this.reads.keys().next().value);
    }
    return entry;
  }

  readsFor(keys, now = Date.now()) {
    const out = [];
    for (const [key, entry] of this.reads) {
      if (now - entry.at > READ_TTL_MS) {
        this.reads.delete(key);
        continue;
      }
      if (keys && !belongsTo(entry, keys)) continue;
      out.push({
        ...entry,
        mode: "read",
        reading: true,
        ttlMs: READ_TTL_MS,
        expiresAt: entry.at + READ_TTL_MS,
      });
    }
    return out.sort((a, b) => b.at - a.at);
  }

  noteWaiter({ agentId, filePath, workspaceId, holder }) {
    const file = normalizeFile(filePath);
    const ws = workspaceRoot(workspaceId) || workspaceId;
    if (!file || !agentId || !ws) return;
    const key = lockKey(ws, file);
    const list = this.waiters.get(key) || new Map();
    list.set(agentId, { agentId, holder: holder || null, at: Date.now() });
    this.waiters.set(key, list);
  }

  takeWaiters(filePath, workspaceId) {
    const file = normalizeFile(filePath);
    const ws = workspaceRoot(workspaceId) || workspaceId;
    if (!file || !ws || !this.waiters) return [];
    const key = lockKey(ws, file);
    const list = this.waiters.get(key);
    if (!list) return [];
    const now = Date.now();
    const out = [];
    for (const [agentId, row] of list) {
      if (now - row.at > WAITER_TTL_MS) {
        list.delete(agentId);
      } else {
        out.push(row);
      }
    }
    if (!list.size) this.waiters.delete(key);
    return out;
  }
}

module.exports = { ObservationTracker };
