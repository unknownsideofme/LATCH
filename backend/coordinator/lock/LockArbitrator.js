const crypto = require("crypto");
const { canonicalWorkspaceFile } = require("../../lib/paths");
const { LockEntry } = require("../LockEntry");
const { sameOwner } = require("./AgentIdentity");
const {
  clampTtl,
  normalizeFile,
  workspaceRoot,
  lockKey,
  alive,
} = require("./LockUtils");
const { MAX_HOOK_KEEP_ALIVE_MS } = require("./LockConstants");

class LockArbitrator {
  constructor(table) {
    this.table = table;
  }

  createDenial(existing, filePath, now, message) {
    const expiresAt = typeof existing.expiresAt === "function"
      ? existing.expiresAt()
      : ((existing.lastHeartbeat || existing.claimedAt) + existing.ttlMs);
    const sessionId = String(existing.agentId || "").split(":").slice(2).join(":");
    const holderLabel = existing.holder?.label || existing.agentId;
    const annotation = existing.annotation || "";
    const note = annotation ? ` (Working on: "${annotation}")` : "";
    const defaultMsg = `File \`${filePath}\` is locked by ${holderLabel}${note}. Pick a different task.`;
    const finalReason = message ? `${message}${note && !message.includes(annotation) ? ` ${note}` : ""}` : defaultMsg;
    return {
      allowed: false,
      status: "DENIED",
      code: "FILE_LOCKED",
      canonicalPath: filePath,
      owner: { agentId: existing.agentId, sessionId },
      holder: existing.agentId,
      annotation: annotation || null,
      expiresInMs: Math.max(0, expiresAt - now),
      retryable: true,
      fencingToken: existing.fencingToken || 0,
      reason: finalReason,
      message: finalReason,
    };
  }

  claim(params) {
    const {
      agentId,
      file,
      ttl,
      workspaceId,
      holder,
      source,
      dependsOn,
      files,
      mode,
      keepAlive = false,
      annotation,
      authoritativeLease,
    } = params;

    let ownershipToken = params.ownershipToken;
    let fencingToken = params.fencingToken;

    const ws = workspaceRoot(workspaceId) || workspaceId;
    if (authoritativeLease) {
      ownershipToken = authoritativeLease.ownershipToken;
      fencingToken = authoritativeLease.fencingToken;
    }
    if (!ws || !/[\\/]/.test(String(ws))) {
      return { allowed: false, reason: "workspace path is required so locks stay per repository" };
    }
    this.table.loadWorkspace(ws);

    // Batch claim handling
    if (Array.isArray(files) && files.length) {
      return this._claimBatch({ ...params, ws, files });
    }

    const filePath = canonicalWorkspaceFile(ws, file);
    if (!filePath) return { allowed: false, code: "INVALID_PATH", reason: "file path is outside the workspace" };
    if (!agentId) return { allowed: false, reason: "agentId and file are required" };

    const matchingLease = (params.leases || []).find((item) => canonicalWorkspaceFile(ws, item.file) === filePath);
    ownershipToken = ownershipToken || matchingLease?.ownershipToken;
    fencingToken = fencingToken ?? matchingLease?.fencingToken;
    const ttlMs = clampTtl(ttl);
    const now = Date.now();
    const lockMode = mode === "read" ? "read" : "write";
    const key = lockKey(ws, filePath);

    // Advisory dependency warning checks
    let warning = null;
    const deps = Array.isArray(dependsOn) ? dependsOn.map(normalizeFile) : [];
    for (const dep of deps) {
      const held = this.table.locks.get(lockKey(ws, dep));
      if (held && held.mode !== "read" && !sameOwner(held.agentId, agentId) && alive(held, now)) {
        warning = `\`${filePath}\` depends on \`${dep}\`, which ${held.holder?.label || held.agentId} is editing`;
        break;
      }
    }

    if (lockMode === "read") {
      this.table.noteRead({ agentId, filePath, workspaceId: ws, holder });
      return { allowed: true, reading: true };
    }

    let existing = this.table.locks.get(key);
    if (existing && !alive(existing, now)) {
      this.table.unpersist(existing.filePath, existing.workspaceId);
      this.table.locks.delete(key);
      existing = null;
    }

    if (existing) {
      if (sameOwner(existing.agentId, agentId) && existing.mode === "write") {
        if (existing.ownershipToken && (
          ownershipToken !== existing.ownershipToken ||
          fencingToken !== existing.fencingToken
        )) {
          return this.createDenial(existing, filePath, now, "Lease ownership token and fencing token are required to renew this lock.");
        }
        if (existing.ownershipToken && !alive(existing, now)) {
          return this.createDenial(existing, filePath, now, "The lock lease has expired.");
        }
        if (!existing.ownershipToken) {
          const nextToken = this.table.nextFencingToken(ws, filePath, authoritativeLease?.fencingToken);
          if (nextToken === null) return { allowed: false, reason: "could not allocate fencing token" };
          existing.ownershipToken = authoritativeLease?.ownershipToken || crypto.randomUUID();
          existing.fencingToken = nextToken;
        }
        if (typeof existing.touch === "function") {
          existing.touch({ now, ttlMs, keepAlive, annotation });
        } else {
          existing.claimedAt = now;
          existing.lastHeartbeat = now;
          existing.ttlMs = ttlMs;
          existing.keepAliveUntil = keepAlive ? now + MAX_HOOK_KEEP_ALIVE_MS : 0;
          if (annotation) existing.annotation = LockEntry.sanitizeAnnotation(annotation);
        }
        existing.workspaceId = ws;
        this.table.persist(existing);
        this.table.emit("change", { type: "renew", entry: existing });
        return { allowed: true, renewed: true, warning, lock: this.table.publicEntry(existing, true) };
      }

      if (existing.mode === "read") {
        this.table.locks.delete(key);
        this.table.unpersist(filePath, ws);
        existing = null;
      }

      if (existing && existing.mode === "write") {
        this.table.noteWaiter({ agentId, filePath, workspaceId: ws, holder });
        return this.createDenial(
          existing,
          filePath,
          now,
          `File \`${filePath}\` is locked by ${existing.holder?.label || existing.agentId}. Pick a different task.`
        );
      }
    }

    const requestedFence = authoritativeLease ? authoritativeLease.fencingToken : undefined;
    const nextFence = this.table.nextFencingToken(ws, filePath, requestedFence);
    if (nextFence === null) return { allowed: false, code: "STALE_FENCING_TOKEN", reason: "fencing token is stale" };

    const entry = new LockEntry({
      filePath,
      agentId,
      mode: lockMode,
      claimedAt: now,
      lastHeartbeat: now,
      ttlMs,
      workspaceId: ws,
      holder: holder || null,
      source: source || "coordinator",
      readers: lockMode === "read" ? new Set([agentId]) : new Set(),
      escalated: false,
      ownershipToken: authoritativeLease?.ownershipToken || crypto.randomUUID(),
      fencingToken: nextFence,
      keepAliveUntil: keepAlive ? now + MAX_HOOK_KEEP_ALIVE_MS : 0,
      annotation,
    });
    this.table.locks.set(key, entry);
    this.table.persist(entry);
    this.table.emit("change", { type: "claim", entry });
    return { allowed: true, warning, lock: this.table.publicEntry(entry, true) };
  }

  _claimBatch(params) {
    const { ws, files, agentId, leases } = params;
    const batch = files.map((item) => canonicalWorkspaceFile(ws, item));
    if (batch.some((item) => !item)) {
      return { allowed: false, code: "INVALID_PATH", reason: "file path is outside the workspace" };
    }
    const sorted = [...new Set(batch)].sort();
    const held = [];
    for (const f of sorted) {
      const lease = (leases || []).find((item) => canonicalWorkspaceFile(ws, item.file) === f);
      const result = this.claim({
        ...params,
        files: undefined,
        file: f,
        ownershipToken: lease?.ownershipToken,
        fencingToken: lease?.fencingToken,
      });
      if (!result.allowed) {
        for (const acquired of held) {
          if (acquired.lock && !acquired.renewed) {
            this.release({
              agentId,
              file: acquired.lock.filePath,
              workspaceId: ws,
              ownershipToken: acquired.lock.ownershipToken,
              fencingToken: acquired.lock.fencingToken,
            });
          }
        }
        return result;
      }
      held.push({ lock: result.lock, renewed: result.renewed });
    }
    return { allowed: true, batch: sorted, locks: held.map((item) => item.lock).filter(Boolean) };
  }

  release({ agentId, file, workspaceId, ownershipToken, fencingToken }) {
    const ws = workspaceRoot(workspaceId) || workspaceId;
    if (!ws) return { ok: false, reason: "workspace_required" };
    const filePath = canonicalWorkspaceFile(ws, file);
    if (!filePath) return { ok: false, reason: "invalid_path" };
    const key = lockKey(ws, filePath);
    const existing = this.table.locks.get(key);
    if (!existing) return { ok: true, released: false };

    if (existing.mode === "read") {
      existing.readers = existing.readers || new Set();
      existing.readers.delete(agentId);
      if (existing.readers.size === 0) {
        this.table.locks.delete(key);
        this.table.unpersist(filePath, ws);
      } else {
        this.table.persist(existing);
      }
      this.table.emit("change", { type: "release", entry: existing });
      return { ok: true, released: true };
    }

    if (!sameOwner(existing.agentId, agentId) || !existing.ownershipToken ||
        ownershipToken !== existing.ownershipToken || fencingToken !== existing.fencingToken) {
      return { ok: false, reason: "not_holder", holder: existing.agentId };
    }

    this.table.locks.delete(key);
    this.table.unpersist(filePath, ws);
    this.table.remember(existing);
    this.table.emit("change", { type: "release", entry: existing });
    return { ok: true, released: true };
  }
}

module.exports = { LockArbitrator };
