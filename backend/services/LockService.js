"use strict";

const { loadRoom } = require("../lib/room");
const { loadRegistry } = require("../lib/store");
const { broadcast } = require("../lib/roomControl");
const { filterKeys, sameOwner } = require("../coordinator/lockTable");
const { normalizeCompare } = require("../lib/transcripts/util");
const { LOCK_OPS, MAX_FILES_PER_CLAIM } = require("../config/constants");
const { ContextService } = require("./ContextService");
const { canonicalWorkspaceFile } = require("../lib/paths");

class LockService {
  constructor({ lockTable, roomLocks, sse, wssControlRef, onBumpCollision, supabaseLockAdapter }) {
    this.lockTable = lockTable;
    this.roomLocks = roomLocks;
    this.sse = sse;
    this.wssControlRef = wssControlRef; // function returning wssControl or object
    this.onBumpCollision = onBumpCollision;
    this.supabaseLockAdapter = supabaseLockAdapter || null;
  }

  get wssControl() {
    return typeof this.wssControlRef === "function" ? this.wssControlRef() : this.wssControlRef;
  }

  lockScope(projectId) {
    const reg = loadRegistry();
    const current = ContextService.currentProject();
    const project =
      reg.projects.find((p) => p.id === projectId || normalizeCompare(p.path) === normalizeCompare(projectId)) ||
      (projectId ? null : current);
    if (!project) return null;
    const room = loadRoom(project.path) || loadRoom();
    const aliases = [];
    if (
      room &&
      (room.hostProjectId === project.id ||
        room.projectId === project.id ||
        normalizeCompare(room.projectPath) === normalizeCompare(project.path) ||
        normalizeCompare(room.hostWorkspacePath) === normalizeCompare(project.path))
    ) {
      aliases.push(room.hostWorkspacePath, room.projectPath, room.hostProjectId, room.projectId);
    }
    return { id: project.id, path: project.path, aliases: aliases.filter(Boolean) };
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

  peerScoped(body, session) {
    if (!session?.remote) return body;
    const room = loadRoom();
    if (!room?.url || room.role !== "host") return body;
    const shared = loadRegistry().projects.find((p) => p.id === room.hostProjectId) || ContextService.currentProject();
    if (!shared?.path) return body;
    return { ...body, workspaceId: shared.path, peerWorkspacePath: body?.workspaceId || null };
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
    const clean = {
      agentId: String(body?.agentId || "").slice(0, 200),
      file: typeof body?.file === "string" ? body.file.slice(0, 1024) : undefined,
      workspaceId: typeof body?.workspaceId === "string" ? body.workspaceId : undefined,
      ttl: Number(body?.ttl) || undefined,
      mode: body?.mode === "read" ? "read" : "write",
      files: Array.isArray(body?.files)
        ? body.files.filter((f) => typeof f === "string").slice(0, MAX_FILES_PER_CLAIM)
        : undefined,
      dependsOn: Array.isArray(body?.dependsOn)
        ? body.dependsOn.filter((f) => typeof f === "string").slice(0, MAX_FILES_PER_CLAIM)
        : undefined,
      holder: body?.holder && typeof body.holder === "object" ? body.holder : null,
      sessionId: typeof body?.sessionId === "string" ? body.sessionId.slice(0, 200) : undefined,
      ownershipToken: typeof body?.ownershipToken === "string" ? body.ownershipToken : undefined,
      fencingToken: Number.isInteger(body?.fencingToken) ? body.fencingToken : undefined,
      leases: Array.isArray(body?.leases)
        ? body.leases.filter((lease) => lease && typeof lease.file === "string").slice(0, MAX_FILES_PER_CLAIM).map((lease) => ({
            file: lease.file.slice(0, 1024),
            ownershipToken: typeof lease.ownershipToken === "string" ? lease.ownershipToken : undefined,
            fencingToken: Number.isSafeInteger(lease.fencingToken) ? lease.fencingToken : undefined,
          }))
        : [],
    };
    if (!clean.agentId) return null;
    if (!clean.sessionId) {
      const parts = clean.agentId.split(":");
      clean.sessionId = parts.length > 2 ? parts.slice(2).join(":") : "";
    }
    if (session?.remote) {
      const login = session.login || "guest";
      clean.agentId = `${clean.agentId}@${login}`;
      clean.holder = { ...(clean.holder || {}), login };
    }
    return clean;
  }

  async runLockRpc(op, body, session, ensureWorkspaceFn) {
    if (!LOCK_OPS.has(op)) return { error: "unknown_op" };
    const clean = this.sanitizeLockBody(body, session);
    if (!clean) return { error: "agent_required" };
    const scoped = this.peerScoped(clean, session);

    if (this.supabaseLockAdapter?.enabled && op === "claim") {
      const rawFiles = Array.isArray(scoped.files) && scoped.files.length ? scoped.files : [scoped.file];
      const files = [...new Set(rawFiles.map((file) => canonicalWorkspaceFile(scoped.workspaceId, file)))].sort();
      if (files.some((file) => !file)) {
        return { allowed: false, code: "INVALID_PATH", reason: "file path is outside the workspace" };
      }
      const acquired = [];
      const rollback = async () => {
        for (const item of acquired.reverse()) {
          if (!item.dbResult.renewed) {
            await this.supabaseLockAdapter.release({
              workspaceId: scoped.workspaceId,
              file: item.file,
              agentId: scoped.agentId,
              sessionId: scoped.sessionId,
              ownershipToken: item.dbResult.ownershipToken,
              fencingToken: Number(item.dbResult.fencingToken),
            });
          }
          if (!item.localResult.renewed) {
            this.lockTable.release({
              agentId: scoped.agentId,
              file: item.file,
              workspaceId: scoped.workspaceId,
              ownershipToken: item.dbResult.ownershipToken,
              fencingToken: Number(item.dbResult.fencingToken),
            });
          }
        }
      };
      for (const file of files) {
        const savedLease = scoped.leases.find((lease) => canonicalWorkspaceFile(scoped.workspaceId, lease.file) === file);
        const dbResult = await this.supabaseLockAdapter.claim({
          workspaceId: scoped.workspaceId,
          file,
          agentId: scoped.agentId,
          sessionId: scoped.sessionId,
          ownershipToken: savedLease?.ownershipToken || scoped.ownershipToken,
          fencingToken: savedLease?.fencingToken ?? scoped.fencingToken,
          mode: scoped.mode,
          ttl: scoped.ttl,
          holder: scoped.holder,
        });
        if (!dbResult) {
          await rollback();
          return {
            allowed: false,
            degraded: true,
            code: "COORDINATOR_UNAVAILABLE",
            reason: "The shared lock service could not verify this lease.",
          };
        }
        if (!dbResult.allowed) {
          await rollback();
          this.recordClaimDenied({ ...scoped, file }, dbResult, ensureWorkspaceFn);
          return dbResult;
        }
        if (!dbResult.ownershipToken || !Number.isSafeInteger(Number(dbResult.fencingToken))) {
          await rollback();
          return {
            allowed: false,
            degraded: true,
            code: "LEASE_CREDENTIALS_MISSING",
            reason: "The shared lock service granted a lease without usable credentials.",
          };
        }
        const localResult = this.lockTable.claim({
          ...scoped,
          file,
          files: undefined,
          leases: [],
          authoritativeLease: {
            ownershipToken: dbResult.ownershipToken,
            fencingToken: Number(dbResult.fencingToken),
          },
        });
        if (!localResult.allowed) {
          if (!dbResult.renewed) {
            await this.supabaseLockAdapter.release({
              workspaceId: scoped.workspaceId,
              file,
              agentId: scoped.agentId,
              sessionId: scoped.sessionId,
              ownershipToken: dbResult.ownershipToken,
              fencingToken: Number(dbResult.fencingToken),
            });
          }
          await rollback();
          this.recordClaimDenied({ ...scoped, file }, localResult, ensureWorkspaceFn);
          return localResult;
        }
        acquired.push({ file, dbResult, localResult });
      }
      if (files.length === 1) return { ...acquired[0].dbResult, source: "supabase" };
      return {
        allowed: true,
        batch: files,
        locks: acquired.map(({ file, dbResult }) => ({
          ...dbResult,
          filePath: file,
          workspaceId: scoped.workspaceId,
        })),
        source: "supabase",
      };
    }

    if (this.supabaseLockAdapter?.enabled && op === "release") {
      const result = await this.supabaseLockAdapter.release({
        workspaceId: scoped.workspaceId,
        file: scoped.file,
        agentId: scoped.agentId,
        sessionId: scoped.sessionId,
        ownershipToken: scoped.ownershipToken,
        fencingToken: scoped.fencingToken,
      });
      if (!result) return { ok: false, degraded: true, reason: "shared_lock_service_unavailable" };
      const local = this.lockTable.release(scoped);
      return { ...result, localReleased: local.released };
    }
    if (this.supabaseLockAdapter?.enabled && op === "heartbeat") {
      const result = await this.supabaseLockAdapter.heartbeat({
        workspaceId: scoped.workspaceId,
        file: scoped.file,
        agentId: scoped.agentId,
        sessionId: scoped.sessionId,
        ownershipToken: scoped.ownershipToken,
        fencingToken: scoped.fencingToken,
        ttl: scoped.ttl,
      });
      if (!result) return { ok: false, degraded: true, reason: "shared_lock_service_unavailable" };
      if (result.ok) this.lockTable.heartbeat(scoped);
      return result;
    }
    if (this.supabaseLockAdapter?.enabled && op === "release-all") {
      const result = await this.supabaseLockAdapter.releaseAll(scoped.agentId, scoped.workspaceId, scoped.sessionId);
      if (!result) return { ok: false, degraded: true, released: [] };
      const local = this.lockTable.releaseAll(scoped.agentId, scoped.workspaceId, scoped.leases);
      return { ...result, localReleased: local.released };
    }

    if (op === "claim") {
      const result = this.lockTable.claim(scoped);
      if (!result.allowed) this.recordClaimDenied(scoped, result, ensureWorkspaceFn);
      return result;
    }
    if (op === "release") return this.lockTable.release(scoped);
    if (op === "heartbeat") return this.lockTable.heartbeat(scoped);
    if (op === "read") {
      const files = (Array.isArray(scoped.files) && scoped.files.length ? scoped.files : [scoped.file]).filter(Boolean);
      for (const file of files) {
        this.lockTable.noteRead({
          agentId: scoped.agentId,
          filePath: file,
          workspaceId: scoped.workspaceId,
          holder: scoped.holder,
        });
      }
      return { ok: true, files };
    }
    return this.lockTable.releaseAll(scoped.agentId, scoped.workspaceId, scoped.leases);
  }
}

module.exports = {
  LockService,
};
