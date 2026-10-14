"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { loadSession, loadRegistry, loadMemory } = require("../lib/store");
const { loadRoom } = require("../lib/room");
const { syncTranscriptsQueued, latestTranscriptMtime } = require("../lib/transcripts/sync");
const { transcriptWatchRoots, discoverAll } = require("../lib/transcripts/discover");
const { normalizeWorkspaceRoot } = require("../lib/transcripts/util");
const { INGEST_COOLDOWN_MS, OWNERSHIP_TTL_MS } = require("../config/constants");

class TranscriptService {
  constructor({ sse, lockTable, onQueueRoomState, onPushRoomHistory }) {
    this.sse = sse;
    this.lockTable = lockTable;
    this.onQueueRoomState = onQueueRoomState;
    this.onPushRoomHistory = onPushRoomHistory;

    this.transcriptWatchers = new Map();
    this.lastIngest = new Map();
    this.ingestAgain = new Set();
    this.transcriptRootHandles = new Map();
    this.ownership = new Map();

    this.startTranscriptSweep();
  }

  observeTranscriptEdits(project, memory) {
    if (!this.lockTable) return;
    const cutoff = Date.now() - 45_000;
    let touched = 0;
    for (const edit of memory?.edits || []) {
      if (!edit?.file || (edit.ts || 0) < cutoff) continue;
      this.lockTable.remember({
        filePath: String(edit.file).replace(/\\/g, "/"),
        agentId: `${edit.agent}:${os.hostname()}:transcript`,
        mode: "write",
        claimedAt: edit.ts,
        lastHeartbeat: edit.ts,
        ttlMs: 15_000,
        workspaceId: project.path,
        holder: { label: edit.agent, login: edit.ownerLogin || null },
        source: "transcript",
        releasedAt: edit.ts,
      });
      touched += 1;
    }
    if (touched) this.lockTable.emit("change");
  }

  ingestTranscripts(project) {
    const since = Date.now() - (this.lastIngest.get(project.id) || 0);
    if (since < INGEST_COOLDOWN_MS) {
      if (!this.ingestAgain.has(project.id)) {
        this.ingestAgain.add(project.id);
        setTimeout(() => {
          this.ingestAgain.delete(project.id);
          this.ingestTranscripts(project);
        }, INGEST_COOLDOWN_MS - since).unref?.();
      }
      return Promise.resolve();
    }
    this.lastIngest.set(project.id, Date.now());
    return syncTranscriptsQueued(project, { ownerLogin: loadSession().login || "local" })
      .then((memory) => {
        this.observeTranscriptEdits(project, memory);
        if (this.sse) {
          this.sse.emit("history", {
            workspaceId: project.id,
            lastSyncAt: Date.now(),
            chats: memory?.chats,
            timeline: memory?.timeline,
            activity: memory?.activity,
            edits: memory?.edits,
            agents: memory?.agents,
          });
        }
        const room = loadRoom(project.path);
        if (room?.role === "host" && typeof this.onQueueRoomState === "function") {
          this.onQueueRoomState(project);
        }
        if (typeof this.onPushRoomHistory === "function") {
          return this.onPushRoomHistory(room, project);
        }
      })
      .catch(() => undefined);
  }

  watchTranscripts(project) {
    if (!project?.path) return;
    const state = this.transcriptWatchers.get(project.id) || { roots: new Set(), timer: null };
    this.transcriptWatchers.set(project.id, state);
    for (const root of transcriptWatchRoots(project.path)) {
      state.roots.add(root);
      this.armTranscriptRoot(root);
    }
  }

  armTranscriptRoot(root) {
    if (this.transcriptRootHandles.has(root)) return;
    let handle;
    try {
      handle = fs.watch(root, { recursive: true }, (_evt, filename) => {
        this.onTranscriptRootChange(root, filename);
      });
    } catch {
      return;
    }
    handle.on("error", () => {
      try {
        handle.close();
      } catch {
        /* ignore */
      }
      this.transcriptRootHandles.delete(root);
    });
    this.transcriptRootHandles.set(root, handle);
  }

  onTranscriptRootChange(root, filename) {
    const changed = filename ? path.resolve(root, filename) : null;
    for (const [projectId, state] of this.transcriptWatchers) {
      if (!state.roots.has(root)) continue;
      const project = loadRegistry().projects.find((p) => p.id === projectId);
      if (!project) continue;
      if (changed && !this.ownsTranscript(project, changed)) continue;
      clearTimeout(state.timer);
      state.timer = setTimeout(() => this.ingestTranscripts(project), 150);
    }
  }

  ownsTranscript(project, absFile) {
    const hit = this.ownership.get(project.id);
    let files = hit && Date.now() - hit.at < OWNERSHIP_TTL_MS ? hit.files : null;
    if (!files) {
      try {
        files = new Set(
          discoverAll(normalizeWorkspaceRoot(project.path) || project.path).map((f) => path.resolve(f.file))
        );
      } catch {
        files = new Set();
      }
      this.ownership.set(project.id, { files, at: Date.now() });
    }
    if (files.has(absFile)) return true;
    if (hit && Date.now() - hit.at < OWNERSHIP_TTL_MS) return false;
    return true;
  }

  stopTranscriptWatch(projectId) {
    const state = this.transcriptWatchers.get(projectId);
    if (state && typeof state === "object" && state.timer) {
      try {
        clearTimeout(state.timer);
      } catch {
        /* ignore */
      }
    }
    this.transcriptWatchers.delete(projectId);
    this.lastIngest.delete(projectId);
    this.ingestAgain.delete(projectId);
    this.ownership.delete(projectId);
  }

  startTranscriptSweep() {
    this.transcriptSweepTimer = setInterval(() => {
      for (const project of loadRegistry().projects) {
        if (!project.path) continue;
        if (this.lockTable) this.lockTable.track(project.path);
        this.watchTranscripts(project);
        try {
          const seen = loadMemory(project.id).lastTranscriptSyncAt || 0;
          const root = normalizeWorkspaceRoot(project.path) || project.path;
          if (latestTranscriptMtime(root) > seen) this.ingestTranscripts(project);
        } catch {
          /* ignore */
        }
      }
    }, 10000);
    if (this.transcriptSweepTimer.unref) this.transcriptSweepTimer.unref();
  }

  stop() {
    if (this.transcriptSweepTimer) clearInterval(this.transcriptSweepTimer);
    for (const h of this.transcriptRootHandles.values()) {
      try {
        h.close();
      } catch {
        /* ignore */
      }
    }
    this.transcriptRootHandles.clear();
  }
}

module.exports = {
  TranscriptService,
};
