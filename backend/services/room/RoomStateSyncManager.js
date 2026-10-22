const { loadRoom, saveRoom } = require("../../lib/room");
const { loadMemory } = require("../../lib/store");
const { mergeRoomViews, localSnapshot, savePeerSnapshot } = require("../../lib/roomSync");
const { mergeCollisionStats, loadLocalCollisions } = require("../../lib/collisionMetrics");
const { broadcast } = require("../../lib/roomControl");
const { ContextService } = require("../ContextService");
const { RoomHttpGateway } = require("./RoomHttpGateway");

class RoomStateSyncManager {
  constructor({ sse, wssRef }) {
    this.sse = sse;
    this.wssRef = wssRef;
    this.lastPushedSync = new Map();
    this.stateTick = null;
    this.lastChatBulkAt = 0;
  }

  get wss() {
    return typeof this.wssRef === "function" ? this.wssRef() : this.wssRef;
  }

  rememberRoster(workspacePath, roster) {
    const room = loadRoom(workspacePath);
    if (!room) return;
    const now = Date.now();
    saveRoom(
      {
        ...room,
        members: roster.map((m) => ({ ...m, lastSeen: m.online ? now : m.lastSeen || 0 })),
      },
      workspacePath
    );
  }

  roomStatePayload(project, type = "state") {
    const memory = loadMemory(project.id);
    const view = mergeRoomViews(memory);
    const login = ContextService.currentUser().login || "local";
    return {
      type,
      hostLogin: login,
      projectId: project.id,
      lastTranscriptSyncAt: memory.lastTranscriptSyncAt || 0,
      chats: view.chats,
      timeline: view.timeline,
      activity: view.activity,
      edits: view.edits,
      agents: view.agents,
      stats: memory.stats || {},
      roomCollisions: mergeCollisionStats(memory, { localLogin: login, projectId: project.id }),
    };
  }

  queueRoomState(project) {
    if (!project) return;
    clearTimeout(this.stateTick);
    this.stateTick = setTimeout(() => {
      setImmediate(() => {
        const room = loadRoom();
        if (room?.role !== "host" || !room.url) return;
        const payload = this.roomStatePayload(project);
        const includeChats = Date.now() - this.lastChatBulkAt > 900;
        if (includeChats) this.lastChatBulkAt = Date.now();
        else delete payload.chats;
        if (this.wss) broadcast(this.wss, payload);
        if (this.sse) {
          setImmediate(() => this.sse.emit("history", { workspaceId: project.id, lastSyncAt: Date.now(), ...payload }));
        }
      });
    }, 40);
    if (this.stateTick.unref) this.stateTick.unref();
  }

  ingestPeerHistory(login, snapshot, project) {
    if (!login || !project) return;
    savePeerSnapshot(project.id, login, snapshot, login);
    this.queueRoomState(project);
  }

  async pushRoomSnapshot(room, project, { force, sendToHostFn } = {}) {
    if (room?.role !== "guest" || !room.url || !project) return;
    const target = room.hostProjectId;
    if (!target) return;
    const memory = loadMemory(project.id);
    const stamp = memory.lastTranscriptSyncAt || 0;
    const collisionStamp = loadLocalCollisions(project.id).updatedAt || 0;
    const pushKey = `${stamp}:${collisionStamp}`;
    if (!force && this.lastPushedSync.get(project.id) === pushKey) return;
    this.lastPushedSync.set(project.id, pushKey);
    const login = ContextService.currentUser().login;
    const snapshot = localSnapshot(memory, login, project.id);
    const payload = { type: "history", projectId: target, login, snapshot };
    if (typeof sendToHostFn === "function" && sendToHostFn(payload)) return;
    try {
      await RoomHttpGateway.fetchHost(room.url, "/api/room/history", {
        method: "POST",
        timeoutMs: 8000,
        body: JSON.stringify(payload),
      });
    } catch {
      this.lastPushedSync.delete(project.id);
    }
  }

  async pullRoomHistory(room, project) {
    if (room?.role !== "guest" || !room.url || !room.hostProjectId || !project) return;
    const login = ContextService.currentUser().login;
    const body = await RoomHttpGateway.fetchHost(
      room.url,
      `/api/room/state?projectId=${encodeURIComponent(room.hostProjectId)}&exclude=${encodeURIComponent(login)}`
    ).then((r) => r.json());
    if (body?.ok) savePeerSnapshot(project.id, "host", body, body.hostLogin || "host");
  }
}

module.exports = { RoomStateSyncManager };
