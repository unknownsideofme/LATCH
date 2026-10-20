"use strict";

const path = require("path");
const { computePatch, recordPatch, applyPeerFile, rewindTo } = require("../lib/patches");
const { loadSession, loadMemory, loadRegistry } = require("../lib/store");
const { pushLocalEdits, pullCentralChanges } = require("../lib/centralSync");
const { loadRoom } = require("../lib/room");
const { broadcast } = require("../lib/roomControl");
const { skipPublish, applyClash, aliveLock } = require("../lib/peerClash");
const { MAX_DIFF_BYTES, PATCH_ROWS, DEFERRED_MAX_MS, WATCH_SETTLE_MS } = require("../config/constants");
const { ContextService } = require("./ContextService");

class PatchService {
  constructor({ sse, lockTable, noticeService, workspaceService, wssRef, sendToHostFn, onBumpCollision, supabaseSyncAdapter }) {
    this.sse = sse;
    this.lockTable = lockTable;
    this.noticeService = noticeService;
    this.workspaceService = workspaceService;
    this.wssRef = wssRef;
    this.sendToHostFn = sendToHostFn;
    this.onBumpCollision = onBumpCollision;
    this.supabaseSyncAdapter = supabaseSyncAdapter || null;

    this.applyingRemote = new Set();
    this.deferredEdits = new Map();
    this.watchTimers = new Map();

    this.startDeferredSweep();
  }

  get wss() {
    return typeof this.wssRef === "function" ? this.wssRef() : this.wssRef;
  }

  broadcastRoom(obj) {
    broadcast(this.wss, obj);
  }

  editRowFor(patch, mine) {
    return {
      id: patch.id,
      agent: patch.agent,
      ownerLogin: patch.ownerLogin,
      mine,
      file: patch.file,
      ts: patch.ts,
      diff: patch.diff || `sha256:${patch.sha256}`,
      lamport: patch.lamport,
      binary: patch.binary,
    };
  }

  patchRows(patches) {
    const rows = [];
    for (const p of patches.slice(-PATCH_ROWS)) {
      const diff = typeof p.diff === "string" ? p.diff : "";
      rows.push({
        id: p.id,
        agent: p.agent,
        ownerLogin: p.ownerLogin,
        mine: p.mine,
        file: p.file,
        ts: p.ts,
        lamport: p.lamport,
        binary: p.binary,
        diff: diff.length > MAX_DIFF_BYTES ? `${diff.slice(0, MAX_DIFF_BYTES)}\n… truncated` : diff,
      });
    }
    return rows;
  }

  broadcastPatch(payload) {
    const edit = payload.patch ? this.editRowFor(payload.patch, !payload.incoming) : null;
    if (this.sse) this.sse.emit("patch", edit ? { ...payload, edit } : payload);
    this.broadcastRoom({ type: "patch", ...payload });
    if (payload.patch) this.notifyWaiters(payload);
  }

  notifyWaiters({ workspaceId, patch }) {
    const project = loadRegistry().projects.find((p) => p.id === workspaceId);
    if (!project || !patch?.file) return;
    const waiters = this.lockTable.takeWaiters(patch.file, project.path);
    if (!waiters.length) return;
    const item = {
      workspaceId: project.id,
      file: patch.file,
      lamport: patch.lamport,
      sha256: patch.sha256,
      by: patch.agent,
      waiters: waiters.map((w) => w.agentId),
      ts: Date.now(),
    };
    if (this.sse) this.sse.emit("file-ready", item);
    this.broadcastRoom({ type: "file-ready", ...item });
    if (this.noticeService) {
      this.noticeService.emitNotice(
        {
          type: "file-ready",
          key: `file-ready:${project.id}:${patch.file}`,
          title: `${patch.file} is free`,
          body: `${patch.agent} finished editing it — ${waiters.length} agent(s) were waiting.`,
          workspaceId: project.id,
          payload: { file: patch.file, lamport: patch.lamport },
        },
        { revive: true }
      );
    }
  }

  peerProject(hint = {}) {
    const reg = loadRegistry();
    const room = loadRoom();
    if (room?.projectId) {
      const pinned = reg.projects.find((p) => p.id === room.projectId);
      if (pinned) return pinned;
    }
    const byRemote = hint.remoteUrl && reg.projects.find((p) => p.remoteUrl && p.remoteUrl === hint.remoteUrl);
    if (byRemote) return byRemote;
    const byName = hint.name && reg.projects.find((p) => p.name === hint.name);
    if (byName) return byName;
    if (hint.pathName) {
      const byBase = reg.projects.find((p) => path.basename(p.path) === hint.pathName);
      if (byBase) return byBase;
    }
    return ContextService.currentProject();
  }

  acceptPeerPatch(patch, hint, { skipIfOrigin } = {}) {
    if (!patch?.file) return { applied: false };
    if (skipIfOrigin && patch.originId && patch.originId === ContextService.originId()) {
      return { applied: false, self: true };
    }
    const project = this.peerProject(hint);
    if (!project) return { applied: false, reason: "no_local_repo" };
    const clash = applyClash(this.lockTable, project.path, patch.file, patch);
    if (clash) {
      if (project?.id && typeof this.onBumpCollision === "function") {
        this.onBumpCollision(project.id, "patch_blocked", {
          file: patch.file,
          holder: clash.holder,
          agent: patch.agent,
          reason: clash.reason,
        });
      }
      return { applied: false, projectId: project.id, ...clash };
    }
    this.applyingRemote.add(`${project.id}:${patch.file}`);
    const result = applyPeerFile(project.id, patch, project.path);
    this.applyingRemote.delete(`${project.id}:${patch.file}`);
    return { ...result, projectId: project.id };
  }

  fanOutLocalFile(project, file, originAgentId) {
    if (!project?.path || !file) return { flushed: false };
    const rel = file.replace(/\\/g, "/");
    const session = loadSession();
    const patch = computePatch({
      workspacePath: project.path,
      file: rel,
      agent: "fs.watch",
      ownerLogin: session.login || "local",
      workspaceId: project.id,
    });
    if (!patch) return { flushed: false };
    const known = (loadMemory(project.id).patches || []).filter((p) => p.file === rel).pop();
    if (known && known.sha256 === patch.sha256) return { flushed: false, unchanged: true, file: rel };
    patch.originId = ContextService.originId();
    patch.originAgentId = originAgentId || ContextService.originId();
    recordPatch(project.id, patch);
    const envelope = {
      workspaceId: project.id,
      patch,
      remoteUrl: project.remoteUrl,
      name: project.name,
      pathName: path.basename(project.path),
      originId: patch.originId,
    };
    this.broadcastPatch(envelope);
    if (this.supabaseSyncAdapter?.enabled) {
      this.supabaseSyncAdapter.publishPatch(project.id, patch);
    }
    const room = loadRoom(project.path);
    if (room?.url && room.role !== "host") {
      const body = { ...envelope, workspaceId: room.hostProjectId || envelope.workspaceId, type: "patch" };
      const sent = typeof this.sendToHostFn === "function" ? this.sendToHostFn(body) : false;
      if (!sent) {
        fetch(`${room.url.replace(/\/$/, "")}/api/patches`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "relay",
            ...(room.memberToken ? { "x-latch-room-token": room.memberToken, "x-relay-room-token": room.memberToken } : {}),
          },
          body: JSON.stringify(body),
        })
          .then((r) => {
            if (!r.ok) console.warn(`[latch-room] host rejected patch for ${rel}: ${r.status}`);
          })
          .catch((err) => console.warn(`[latch-room] could not send patch for ${rel}: ${err.message || err}`));
      }
    }
    const memory = loadMemory(project.id);
    pushLocalEdits(project.path, project.id, memory).then(() => pullCentralChanges(project.path)).catch(() => undefined);
    if (this.workspaceService) this.workspaceService.publishGraph(project);
    return { flushed: true, file: rel };
  }

  handleWatcherChange(evt) {
    const key = `${evt.workspacePath}:${evt.file}`;
    clearTimeout(this.watchTimers.get(key));
    this.watchTimers.set(
      key,
      setTimeout(() => {
        this.watchTimers.delete(key);
        this.onFileSettled(evt);
      }, WATCH_SETTLE_MS)
    );
  }

  onFileSettled({ workspacePath, workspaceId, file }) {
    const now = Date.now();
    if (workspaceId && this.applyingRemote.has(workspaceId)) return;
    const project =
      loadRegistry().projects.find((p) => p.id === workspaceId || p.path === workspacePath) ||
      (this.workspaceService ? this.workspaceService.ensureWorkspace(workspacePath) : null);
    if (!project) return;
    if (this.applyingRemote.has(project.id) || this.applyingRemote.has(`${project.id}:${file}`)) return;
    const rel = file.replace(/\\/g, "/");
    const publish = skipPublish(this.lockTable, project.path, rel);
    if (publish.skip) {
      if (typeof this.onBumpCollision === "function") {
        this.onBumpCollision(project.id, "patch_skipped", {
          file: rel,
          holder: publish.held?.agentId,
          reason: publish.reason,
        });
      }
      return;
    }
    const held = publish.held;
    if (held) {
      this.lockTable.heartbeat({
        agentId: held.agentId,
        file: rel,
        workspaceId: project.path,
        ownershipToken: held.ownershipToken,
        fencingToken: held.fencingToken,
      });
    }
    if (publish.defer) {
      this.deferredEdits.set(`${project.id}:${rel}`, { project, rel, agentId: held?.agentId || null, at: now });
      if (typeof this.onBumpCollision === "function") {
        this.onBumpCollision(project.id, "patch_deferred", { file: rel, agentId: held?.agentId });
      }
      return;
    }
    this.fanOutLocalFile(project, rel, held?.agentId);
  }

  startDeferredSweep() {
    this.deferredSweepTimer = setInterval(() => {
      if (!this.deferredEdits.size) return;
      const now = Date.now();
      for (const [key, entry] of [...this.deferredEdits]) {
        const stale = now - entry.at > DEFERRED_MAX_MS;
        if (!stale && aliveLock(this.lockTable, entry.rel, entry.project.path)) continue;
        this.deferredEdits.delete(key);
        if (stale) continue;
        try {
          this.fanOutLocalFile(entry.project, entry.rel, entry.agentId);
        } catch (err) {
          console.warn(`[latch] deferred publish ${entry.rel}: ${err.message || err}`);
        }
      }
    }, 750);
    if (this.deferredSweepTimer.unref) this.deferredSweepTimer.unref();
  }

  stop() {
    if (this.deferredSweepTimer) clearInterval(this.deferredSweepTimer);
    for (const t of this.watchTimers.values()) clearTimeout(t);
    this.watchTimers.clear();
  }
}

module.exports = {
  PatchService,
};
