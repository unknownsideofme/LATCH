"use strict";

const { loadRoom } = require("../lib/room");
const { broadcast } = require("../lib/roomControl");
const { filterKeys, sameOwner } = require("../coordinator/lockTable");
const { LOCK_OPS } = require("../config/constants");
const { ContextService } = require("./ContextService");
const { LockBodySanitizer } = require("./lock/LockBodySanitizer");
const { LockScopeResolver } = require("./lock/LockScopeResolver");
const { SupabaseClaimStrategy } = require("./lock/SupabaseClaimStrategy");

class LockService {
  constructor({
    lockTable,
    roomLocks,
    sse,
    wssControlRef,
    onBumpCollision,
    supabaseLockAdapter,
    useSupabaseLocks = false,
  }) {
    this.lockTable = lockTable;
    this.roomLocks = roomLocks;
    this.sse = sse;
    this.wssControlRef = wssControlRef;
    this.onBumpCollision = onBumpCollision;
    this.supabaseLockAdapter = supabaseLockAdapter || null;
    this.useSupabaseLocks = Boolean(useSupabaseLocks);

    this.supabaseStrategy = new SupabaseClaimStrategy({
      supabaseLockAdapter: this.supabaseLockAdapter,
      lockTable: this.lockTable,
      recordClaimDenied: (scoped, res, fn) => this.recordClaimDenied(scoped, res, fn),
    });
  }

  get wssControl() {
    return typeof this.wssControlRef === "function" ? this.wssControlRef() : this.wssControlRef;
  }

  lockScope(projectId) {
    return LockScopeResolver.resolve(projectId);
  }

  peerScoped(body, session) {
    return LockScopeResolver.peerScoped(body, session);
  }

  readsFor(scope) {
    try {
      if (!scope) return [];
      const local = this.lockTable.readsFor(filterKeys(scope));
      const mirrored = typeof this.roomLocks?.listReads === "function" ? this.roomLocks.listReads() : null;
      if (!mirrored) return local;
      const onHost = new Set(mirrored.map((r) => `${r.filePath}::${r.agentId}`));
      return [...mirrored, ...local.filter((r) => !onHost.has(`${r.filePath}::${r.agentId}`))];
    } catch (err) {
      console.warn(`[latch] readsFor: ${err.message || err}`);
      return [];
    }
  }

  locksFor(scope) {
    try {
      const mirrored = this.roomLocks?.list() || null;
      const local = scope ? this.lockTable.list(scope) : [];
      if (!mirrored) return local;
      const onHost = new Set(mirrored.map((l) => `${l.filePath}::${l.agentId}`));
      return [...mirrored, ...local.filter((l) => !onHost.has(`${l.filePath}::${l.agentId}`))];
    } catch (err) {
      console.warn(`[latch] locksFor: ${err.message || err}`);
      return [];
    }
  }

  broadcastLocks(locks, reads) {
    const room = loadRoom();
    if (room?.role !== "host" || !room.url) return;
    const project = ContextService.currentProject();
    const scope = this.lockScope(room.hostProjectId || project?.id);
    broadcast(this.wssControl, {
      type: "locks",
      workspaceId: room.hostProjectId || project?.id || null,
      locks,
      reads: Array.isArray(reads) ? reads : this.readsFor(scope),
    });
  }

  recordClaimDenied(scoped, result, ensureWorkspaceFn) {
    const project = ContextService.projectForPath(scoped.workspaceId, ensureWorkspaceFn) || ContextService.currentProject();
    if (project?.id && typeof this.onBumpCollision === "function") {
      this.onBumpCollision(project.id, "claim_blocked", {
        file: scoped.file,
        agentId: scoped.agentId,
        holder: result.holder,
        reason: result.reason,
        via: "room_rpc",
      });
    }
  }

  sanitizeLockBody(body, session) {
    return LockBodySanitizer.sanitize(body, session);
  }

  async runLockRpc(op, body, session, ensureWorkspaceFn) {
    if (!LOCK_OPS.has(op)) return { error: "unknown_op" };
    const clean = this.sanitizeLockBody(body, session);
    if (!clean) return { error: "agent_required" };
    const scoped = this.peerScoped(clean, session);

    if (this.useSupabaseLocks && this.supabaseLockAdapter?.enabled && op === "claim") {
      return this.supabaseStrategy.executeClaim(scoped, ensureWorkspaceFn);
    }

    if (op === "claim") {
      const result = this.lockTable.claim(scoped);
      if (!result.allowed) this.recordClaimDenied(scoped, result, ensureWorkspaceFn);
      return result;
    }

    if (op === "heartbeat") {
      return this.lockTable.heartbeat(scoped);
    }

    if (op === "release") {
      return this.lockTable.release(scoped);
    }

    if (op === "release-all") {
      return this.lockTable.releaseAll(scoped.agentId, scoped.workspaceId, scoped.leases);
    }

    if (op === "status") {
      return this.lockTable.status(scoped);
    }

    return { error: "unsupported_op" };
  }

  statusSummary(projectId) {
    const scope = this.lockScope(projectId);
    const active = this.locksFor(scope);
    const reads = this.readsFor(scope);
    return {
      activeWrites: active.filter((l) => l.mode === "write" && !l.released).length,
      activeReads: reads.length,
      locks: active,
      reads,
    };
  }
}

module.exports = { LockService };
