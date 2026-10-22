const { EventEmitter } = require("events");
const crypto = require("crypto");
const { canonicalWorkspaceFile } = require("../../lib/paths");
const { LockEntry } = require("../LockEntry");
const { DEFAULT_TTL_MS, CLEANUP_MS } = require("./LockConstants");
const {
  clampTtl,
  normalizeFile,
  normWorkspace,
  workspaceRoot,
  lockKey,
  lockHash,
  sameWorkspace,
  filterKeys,
  belongsTo,
  alive,
} = require("./LockUtils");
const { AgentIdentity, sameOwner } = require("./AgentIdentity");
const { FencingTokenManager } = require("./FencingTokenManager");
const { LockStorageBridge } = require("./LockStorageBridge");
const { ObservationTracker } = require("./ObservationTracker");
const { DiskWorkspaceScanner } = require("./DiskWorkspaceScanner");
const { LockArbitrator } = require("./LockArbitrator");

class LockTable extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.locks = new Map();
    this.locksDir = opts.locksDir || null;
    this.defaultWorkspace = opts.workspacePath || null;
    this._timer = null;
    this._tracked = new Set();

    // Collaborating components following SRP & Dependency Injection
    this.fencingManager = new FencingTokenManager((ws) => this.dirFor(ws));
    this.storageBridge = new LockStorageBridge((ws) => this.dirFor(ws));
    this.tracker = new ObservationTracker();
    this.scanner = new DiskWorkspaceScanner(this);
    this.arbitrator = new LockArbitrator(this);
  }

  // Fencing token accessors for backward compatibility
  get fencingTokens() {
    return this.fencingManager.tokens;
  }

  // Tracker state accessors for backward compatibility
  get recent() {
    return this.tracker.recent;
  }
  set recent(val) {
    this.tracker.recent = val;
  }

  get reads() {
    return this.tracker.reads;
  }
  set reads(val) {
    this.tracker.reads = val;
  }

  get waiters() {
    return this.tracker.waiters;
  }
  set waiters(val) {
    this.tracker.waiters = val;
  }

  startCleanup() {
    if (this._timer) return;
    this._timer = setInterval(() => this.sweepExpired(), CLEANUP_MS);
    if (this._timer.unref) this._timer.unref();
  }

  stopCleanup() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  dirFor(workspaceId) {
    return this.scanner.dirFor(workspaceId);
  }

  persist(entry) {
    return this.storageBridge.persist(entry);
  }

  unpersist(filePath, workspaceId) {
    return this.storageBridge.unpersist(filePath, workspaceId);
  }

  nextFencingToken(workspaceId, filePath, requested) {
    return this.fencingManager.next(workspaceId, filePath, requested);
  }

  denial(existing, filePath, now, message) {
    return this.arbitrator.createDenial(existing, filePath, now, message);
  }

  ingestEntry(entry, fallbackWorkspace) {
    return this.scanner.ingestEntry(entry, fallbackWorkspace);
  }

  loadWorkspace(workspacePath) {
    return this.scanner.loadWorkspace(workspacePath);
  }

  loadFromDisk() {
    return this.scanner.loadFromDisk();
  }

  getLock(file, workspaceId) {
    const ws = workspaceRoot(workspaceId) || workspaceId;
    const canonicalFile = canonicalWorkspaceFile(ws, file);
    if (!ws || !canonicalFile) return null;
    this.loadWorkspace(ws);
    return this.locks.get(lockKey(ws, canonicalFile)) || null;
  }

  publicEntry(entry, includeLease = false) {
    if (entry && typeof entry.toPublic === "function") {
      return entry.toPublic(includeLease);
    }
    const result = {
      filePath: entry.filePath,
      agentId: entry.agentId,
      mode: entry.mode || "write",
      claimedAt: entry.claimedAt,
      lastHeartbeat: entry.lastHeartbeat,
      ttlMs: entry.ttlMs,
      expiresAt: (entry.lastHeartbeat || entry.claimedAt) + entry.ttlMs,
      workspaceId: entry.workspaceId || null,
      source: entry.source || "coordinator",
      holder: entry.holder || null,
      annotation: entry.annotation || null,
      readers: [...(entry.readers || [])],
      escalated: Boolean(entry.escalated),
      fencingToken: entry.fencingToken || 0,
    };
    if (includeLease) result.ownershipToken = entry.ownershipToken;
    return result;
  }

  status(filter) {
    const keys = filter ? filterKeys(filter) : null;
    const locks = {};
    for (const entry of this.locks.values()) {
      if (keys && !belongsTo(entry, keys)) continue;
      locks[`${normWorkspace(entry.workspaceId)}::${entry.filePath}`] = this.publicEntry(entry);
    }
    return { locks, uptime: process.uptime() };
  }

  list(workspaceId) {
    const keys = filterKeys(workspaceId);
    const root =
      workspaceRoot(typeof workspaceId === "object" ? workspaceId?.path || workspaceId?.workspaceId : workspaceId) ||
      (typeof workspaceId === "object" ? workspaceRoot(workspaceId?.path) : null);
    if (root) this.loadWorkspace(root);
    const out = [];
    for (const entry of this.locks.values()) {
      if (!belongsTo(entry, keys)) continue;
      out.push(this.publicEntry(entry));
    }
    out.push(...this.tracker.recentFor(keys, this.locks, Date.now(), (e) => this.publicEntry(e)));
    return out.sort((a, b) => (b.releasedAt || b.claimedAt) - (a.releasedAt || a.claimedAt));
  }

  heartbeat({ agentId, file, workspaceId, ownershipToken, fencingToken, ttl, leases = [] }) {
    const now = Date.now();
    const ws = workspaceRoot(workspaceId);
    const canonicalFile = file ? canonicalWorkspaceFile(ws, file) : null;
    if (file && !canonicalFile) return { ok: false, renewed: 0, reason: "invalid_path" };
    const leaseFor = new Map((Array.isArray(leases) ? leases : []).map((lease) => [
      canonicalWorkspaceFile(ws, lease.file),
      lease,
    ]));
    let n = 0;
    for (const entry of this.locks.values()) {
      if (ws && !sameWorkspace(entry.workspaceId, ws)) continue;
      if (!ws) continue;
      const matchFile = !file || canonicalFile === entry.filePath;
      const lease = leaseFor.get(entry.filePath);
      const token = lease?.ownershipToken || ownershipToken;
      const fence = lease?.fencingToken ?? fencingToken;
      if (matchFile && sameOwner(entry.agentId, agentId) && token === entry.ownershipToken &&
          fence === entry.fencingToken && alive(entry, now)) {
        entry.lastHeartbeat = now;
        entry.ttlMs = clampTtl(ttl || entry.ttlMs);
        this.persist(entry);
        n += 1;
      }
    }
    if (n) this.emit("change", { type: "heartbeat", agentId, workspaceId: ws });
    return n ? { ok: true, renewed: n } : { ok: false, renewed: 0, reason: "lease_required" };
  }

  escalateRegister(entry) {
    const ws = workspaceRoot(entry.workspaceId) || entry.workspaceId;
    if (!ws) return { ok: false, reason: "workspace_required" };
    const filePath = canonicalWorkspaceFile(ws, entry.filePath);
    if (!filePath) return { ok: false, reason: "invalid_path" };
    const key = lockKey(ws, filePath);
    const existing = this.locks.get(key);
    if (existing && alive(existing) && !sameOwner(existing.agentId, entry.agentId)) {
      return { ok: false, winner: existing.agentId };
    }
    const now = Date.now();
    const fencingToken = existing?.fencingToken || this.nextFencingToken(ws, filePath, entry.fencingToken);
    if (fencingToken === null) return { ok: false, reason: "stale_fencing_token" };
    const next = {
      ...entry,
      filePath,
      workspaceId: ws,
      readers: new Set(entry.readers || []),
      claimedAt: entry.claimedAt || now,
      lastHeartbeat: now,
      ttlMs: clampTtl(entry.ttlMs),
      escalated: true,
      source: "escalated",
      ownershipToken: existing?.ownershipToken || entry.ownershipToken || crypto.randomUUID(),
      fencingToken,
    };
    this.locks.set(key, next);
    this.persist(next);
    this.emit("change", { type: "escalate", entry: next });
    return { ok: true, lock: this.publicEntry(next) };
  }

  claim(params) {
    return this.arbitrator.claim(params);
  }

  release(params) {
    return this.arbitrator.release(params);
  }

  remember(entry) {
    this.tracker.remember(entry);
  }

  noteRead(params) {
    const entry = this.tracker.noteRead(params);
    if (entry) this.emit("change", { type: "read", entry });
    return entry;
  }

  readsFor(keys, now) {
    return this.tracker.readsFor(keys, now);
  }

  noteWaiter(params) {
    return this.tracker.noteWaiter(params);
  }

  takeWaiters(filePath, workspaceId) {
    return this.tracker.takeWaiters(filePath, workspaceId);
  }

  recentFor(keys, now) {
    return this.tracker.recentFor(keys, this.locks, now, (e) => this.publicEntry(e));
  }

  releaseAll(agentId, workspaceId, leases = []) {
    const ws = workspaceRoot(workspaceId) || workspaceId;
    const leaseFor = new Map((Array.isArray(leases) ? leases : []).map((lease) => [
      canonicalWorkspaceFile(ws, lease.file),
      lease,
    ]));
    const released = [];
    for (const [, entry] of [...this.locks]) {
      if (ws && !sameWorkspace(entry.workspaceId, ws)) continue;
      if (!ws) continue;
      if (sameOwner(entry.agentId, agentId)) {
        const lease = leaseFor.get(entry.filePath);
        const result = this.release({
          agentId,
          file: entry.filePath,
          workspaceId: entry.workspaceId,
          ownershipToken: lease?.ownershipToken,
          fencingToken: lease?.fencingToken,
        });
        if (result.released) released.push(entry.filePath);
      }
    }
    return { released };
  }

  track(workspacePath) {
    const root = workspaceRoot(workspacePath) || workspacePath;
    if (!root) return;
    this._tracked.add(root);
  }

  sweepExpired() {
    for (const root of this._tracked) {
      try {
        this.loadWorkspace(root);
      } catch {
        /* keep sweeping */
      }
    }
    const now = Date.now();
    let changed = false;
    for (const [key, entry] of [...this.locks]) {
      if (!alive(entry, now)) {
        this.locks.delete(key);
        this.unpersist(entry.filePath, entry.workspaceId);
        this.remember(entry);
        changed = true;
      } else if (entry.keepAliveUntil > now) {
        entry.lastHeartbeat = now;
        this.persist(entry);
        changed = true;
      } else if (entry.keepAliveUntil) {
        entry.keepAliveUntil = 0;
        this.persist(entry);
      }
    }
    if (changed) this.emit("change");
    return changed;
  }
}

module.exports = {
  LockTable,
  DEFAULT_TTL_MS,
  normalizeFile,
  lockHash,
  sameOwner,
  normWorkspace,
  workspaceRoot,
  filterKeys,
};
