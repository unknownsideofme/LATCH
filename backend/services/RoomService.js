"use strict";

const { loadRoom } = require("../lib/room");
const { loadRegistry, loadMemory } = require("../lib/store");
const { RoomLockMirror } = require("../lib/roomLocks");
const { RoomControl, broadcast } = require("../lib/roomControl");
const { recordCollision, mergeCollisionStats } = require("../lib/collisionMetrics");
const { repoKeyFromRemote } = require("../lib/roomSignal");
const { dismissByKey } = require("../lib/notices");
const { ContextService } = require("./ContextService");
const { RoomHttpGateway } = require("./room/RoomHttpGateway");
const { RoomTunnelCoordinator } = require("./room/RoomTunnelCoordinator");
const { RoomDiscoveryCoordinator } = require("./room/RoomDiscoveryCoordinator");
const { RoomJoinResolver } = require("./room/RoomJoinResolver");
const { RoomStateSyncManager } = require("./room/RoomStateSyncManager");

class RoomService {
  constructor({ sse, lockService, noticeService, workspaceService, wssRef }) {
    this.sse = sse;
    this.lockService = lockService;
    this.noticeService = noticeService;
    this.workspaceService = workspaceService;
    this.wssRef = wssRef;

    this.roomControl = new RoomControl();
    this.roomLocks = new RoomLockMirror({
      fetchLocks: async (room) => {
        const body = await this.fetchHost(
          room.url,
          `/api/locks?projectId=${encodeURIComponent(room.hostProjectId)}`
        ).then((r) => r.json());
        return { locks: body.locks || [], reads: body.reads || [] };
      },
    });

    this.tunnelCoordinator = new RoomTunnelCoordinator({ sse, wssRef });
    this.discoveryCoordinator = new RoomDiscoveryCoordinator({
      sse,
      noticeService,
      syncRoomLocksFn: () => this.syncRoomLocks(),
    });
    this.stateSyncManager = new RoomStateSyncManager({ sse, wssRef });

    this.initListeners();
  }

  get discoverState() {
    return this.discoveryCoordinator.discoverState;
  }

  get lastPushedSync() {
    return this.stateSyncManager.lastPushedSync;
  }

  get wss() {
    return typeof this.wssRef === "function" ? this.wssRef() : this.wssRef;
  }

  broadcastRoom(obj) {
    if (this.wss) broadcast(this.wss, obj);
  }

  initListeners() {
    this.roomControl.onReplay = ({ rejected }) => {
      if (!rejected?.length) return;
      const room = loadRoom();
      const files = [...new Set(rejected.map((r) => r.body?.file).filter(Boolean))];
      if (this.noticeService) {
        this.noticeService.emitNotice(
          {
            type: "replay_rejected",
            key: `replay_rejected:${room?.roomId || "room"}`,
            title: `${rejected.length} offline ${rejected.length === 1 ? "release" : "releases"} did not reach the host`,
            body: files.length
              ? `Still held room-wide until they expire: ${files.slice(0, 3).join(", ")}${
                  files.length > 3 ? ` and ${files.length - 3} more` : ""
                }.`
              : "They will expire on their own TTL.",
            workspaceId: room?.projectId || ContextService.currentProject()?.id || null,
          },
          { revive: true }
        );
      }
    };

    this.roomControl.onLocks = (msg) => {
      const current = loadRoom();
      if (msg.workspaceId && current?.hostProjectId && msg.workspaceId !== current.hostProjectId) return;
      this.roomLocks.accept(msg.locks, { reads: msg.reads });
    };

    this.roomLocks.on("change", ({ locks, reads }) => {
      const room = loadRoom();
      const workspaceId = room?.projectId || ContextService.currentProject()?.id;
      if (this.sse) {
        this.sse.emit("locks", {
          workspaceId,
          locks,
          reads: Array.isArray(reads) ? reads : this.lockService.readsFor(this.lockService.lockScope(workspaceId)),
        });
      }
      const health = this.roomLocks.health;
      if (health.joined && !health.reachable && this.roomLocks.failures >= 3 && this.noticeService) {
        this.noticeService.emitNotice(
          {
            type: "host_offline",
            key: `host_offline:${room?.roomId || "room"}`,
            title: `@${room?.hostLogin || "host"} went offline`,
            body: "Waiting to reconnect to the shared room.",
            workspaceId: room?.projectId || ContextService.currentProject()?.id || null,
          },
          { revive: true }
        );
      }
      if (health.joined && health.reachable && this.noticeService) {
        const key = `host_offline:${room?.roomId || "room"}`;
        if (dismissByKey(key)) {
          this.noticeService.emitNotice(
            {
              type: "host_online",
              key: `host_online:${room?.roomId || "room"}`,
              title: `@${room?.hostLogin || "host"} is back`,
              body: "Reconnected to the shared room.",
              workspaceId: room?.projectId || ContextService.currentProject()?.id || null,
            },
            { revive: true }
          );
        }
      }
    });
  }

  fetchHost(url, pathname, init = {}) {
    return RoomHttpGateway.fetchHost(url, pathname, init);
  }

  async announceToHost(room, user = ContextService.currentUser()) {
    if (!room?.url || room.role !== "guest") return null;
    const active = this.workspaceService && room.projectId ? this.workspaceService.activeAgent(room.projectId) : {};
    const res = await this.fetchHost(room.url, "/api/room/hello", {
      method: "POST",
      body: JSON.stringify({
        user: { ...user, ...active },
        role: "guest",
        hostProjectId: room.hostProjectId,
      }),
    });
    return res.json();
  }

  rememberRoster(workspacePath, roster) {
    return this.stateSyncManager.rememberRoster(workspacePath, roster);
  }

  syncRoomLocks() {
    this.roomLocks.start(loadRoom());
  }

  shareExtras(project) {
    const user = ContextService.currentUser();
    return {
      hostProjectId: project?.id,
      workspacePath: project?.path,
      projectName: project?.name,
      hostUser: user,
      hostLogin: user.login,
      repoKey: repoKeyFromRemote(project?.remoteUrl),
    };
  }

  roomStatePayload(project, type = "state") {
    return this.stateSyncManager.roomStatePayload(project, type);
  }

  queueRoomState(project) {
    return this.stateSyncManager.queueRoomState(project);
  }

  ingestPeerHistory(login, snapshot, project) {
    return this.stateSyncManager.ingestPeerHistory(login, snapshot, project);
  }

  async pushRoomSnapshot(room, project, opts) {
    return this.stateSyncManager.pushRoomSnapshot(room, project, opts);
  }

  async pushRoomHistory(room, project, sendToHostFn) {
    return this.pushRoomSnapshot(room, project, { force: false, sendToHostFn });
  }

  async pullRoomHistory(room, project) {
    return this.stateSyncManager.pullRoomHistory(room, project);
  }

  notifyCollisionMetrics(project, sendToHostFn) {
    if (!project?.id) return;
    const room = loadRoom(project.path);
    const login = ContextService.currentUser().login || "local";
    const merged = mergeCollisionStats(loadMemory(project.id), { localLogin: login, projectId: project.id });
    if (this.sse) this.sse.emit("metrics", { workspaceId: project.id, collisions: merged });
    if (room?.role === "host" && room.url) this.queueRoomState(project);
    else if (room?.role === "guest" && room.url) {
      this.pushRoomSnapshot(room, project, { force: true, sendToHostFn }).catch(() => undefined);
    }
  }

  bumpCollision(projectId, kind, detail = {}, sendToHostFn) {
    recordCollision(projectId, kind, detail);
    const project = loadRegistry().projects.find((p) => p.id === projectId);
    if (project) this.notifyCollisionMetrics(project, sendToHostFn);
  }

  async refreshGuestRoom(room) {
    return this.discoveryCoordinator.refreshGuestRoom(room);
  }

  async refreshOpenRooms(project, opts) {
    return this.discoveryCoordinator.refreshOpenRooms(project, opts);
  }

  syncInviteNotices(project, rooms) {
    return this.discoveryCoordinator.syncInviteNotices(project, rooms);
  }

  stopTunnelWatch() {
    return this.tunnelCoordinator.stopTunnelWatch();
  }

  startTunnelWatch() {
    return this.tunnelCoordinator.startTunnelWatch();
  }

  async publishAndWatch(room, project) {
    return this.tunnelCoordinator.publishAndWatch(room, project);
  }

  async maintainHostTunnel() {
    return this.tunnelCoordinator.maintainHostTunnel();
  }

  static defaultJoinDir(name) {
    return RoomJoinResolver.defaultJoinDir(name);
  }

  resolveJoinProject(hostMeta, explicitPath) {
    return RoomJoinResolver.resolveJoinProject(hostMeta, explicitPath, this.workspaceService);
  }

  async seedFromHost(url, hostProjectId, project, applyingRemote) {
    return RoomJoinResolver.seedFromHost(url, hostProjectId, project, applyingRemote);
  }

  static decodeParam(value) {
    return RoomJoinResolver.decodeParam(value);
  }

  static splitInviteUrl(raw) {
    return RoomJoinResolver.splitInviteUrl(raw);
  }

  async resolveJoinTarget(body) {
    return RoomJoinResolver.resolveJoinTarget(body);
  }
}

module.exports = { RoomService };
