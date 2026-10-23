const {
  repoKeyFromRemote,
  findSignal,
  discoverRooms,
} = require("../../lib/roomSignal");
const { fetchCollaborators: fetchGithubCollaborators } = require("../../lib/githubRepo");
const { loadRoom, saveRoom } = require("../../lib/room");
const { dismissByKey } = require("../../lib/notices");
const { ContextService } = require("../ContextService");

class RoomDiscoveryCoordinator {
  constructor({ sse, noticeService, syncRoomLocksFn }) {
    this.sse = sse;
    this.noticeService = noticeService;
    this.syncRoomLocksFn = syncRoomLocksFn;
    this.discoverState = { at: 0, key: "", rooms: [] };
  }

  async refreshGuestRoom(room) {
    if (room?.role !== "guest") return room;
    const project = ContextService.currentProject();
    const repoKey = room.repoKey || repoKeyFromRemote(project?.remoteUrl);
    try {
      const signal = await findSignal({
        gistId: room.signalGistId,
        hostLogin: room.hostLogin,
        repoKey,
        roomId: room.roomId,
      });
      if (!signal?.url || signal.live === false) return room;
      if (signal.url === room.url) return room;
      const next = saveRoom(
        {
          ...room,
          url: signal.url,
          roomId: signal.roomId || room.roomId,
          signalGistId: signal.gistId || room.signalGistId,
          repoKey: signal.repoKey || repoKey,
          hostLogin: signal.hostLogin || room.hostLogin,
        },
        room.projectPath || project?.path
      );
      console.log(`[latch-room] host moved to ${signal.url}`);
      if (this.sse) this.sse.emit("presence", { workspaceId: room.projectId || project?.id, reconnect: true });
      if (this.noticeService) {
        this.noticeService.emitNotice(
          {
            type: "host_online",
            key: `host_online:${room.roomId || "room"}`,
            title: `@${room.hostLogin || "host"} is back`,
            body: "Reconnected to the shared room.",
            workspaceId: room.projectId || project?.id || null,
          },
          { revive: true }
        );
      }
      dismissByKey(`host_offline:${room.roomId || "room"}`);
      if (typeof this.syncRoomLocksFn === "function") this.syncRoomLocksFn();
      return next;
    } catch {
      return room;
    }
  }

  async refreshOpenRooms(project, { force } = {}) {
    const key = repoKeyFromRemote(project?.remoteUrl);
    if (!key) return [];
    if (!force && this.discoverState.key === key && Date.now() - this.discoverState.at < 12_000) {
      return this.discoverState.rooms;
    }
    const me = ContextService.currentUser().login;
    let collabs = [];
    try {
      collabs = await fetchGithubCollaborators(project.remoteUrl);
    } catch {
      collabs = [];
    }
    const rooms = await discoverRooms({
      repoKey: key,
      logins: collabs.map((c) => c.login),
      myLogin: me,
    });
    this.discoverState.at = Date.now();
    this.discoverState.key = key;
    this.discoverState.rooms = rooms;
    this.syncInviteNotices(project, rooms);
    return rooms;
  }

  syncInviteNotices(project, rooms) {
    if (!this.noticeService) return;
    const current = loadRoom(project?.path);
    const live = new Set();
    for (const room of rooms || []) {
      if (!room?.roomId) continue;
      const key = `invite:${room.roomId}`;
      live.add(key);
      if (current?.roomId && current.roomId === room.roomId) continue;
      this.noticeService.emitNotice({
        type: "invite",
        key,
        title: `@${room.hostLogin} invited you`,
        body: `Join the shared room${room.projectName ? ` for ${room.projectName}` : ""}.`,
        action: "join",
        workspaceId: project?.id || null,
        payload: {
          hostLogin: room.hostLogin,
          roomId: room.roomId,
          gistId: room.gistId || null,
          url: room.url,
          projectName: room.projectName || project?.name || null,
          projectId: project?.id || null,
        },
      });
    }
    for (const n of require("../../lib/notices").listNotices()) {
      if (n.type === "invite" && n.key && !live.has(n.key) && !(current?.roomId && n.key === `invite:${current.roomId}`)) {
        dismissByKey(n.key);
      }
    }
  }
}

module.exports = { RoomDiscoveryCoordinator };
