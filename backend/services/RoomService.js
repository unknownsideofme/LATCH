"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { loadRoom, saveRoom, share: shareRoom, ensureTunnel, upsertMember, membersView } = require("../lib/room");
const { loadRegistry, loadSession, loadMemory } = require("../lib/store");
const { RoomLockMirror } = require("../lib/roomLocks");
const { RoomControl, broadcast } = require("../lib/roomControl");
const { localSnapshot, savePeerSnapshot, mergeRoomViews } = require("../lib/roomSync");
const { recordCollision, mergeCollisionStats, loadLocalCollisions } = require("../lib/collisionMetrics");
const {
  repoKeyFromRemote,
  publishSignal,
  findSignal,
  discoverRooms,
  GIST_SCOPE_HINT,
} = require("../lib/roomSignal");
const { dismissByKey } = require("../lib/notices");
const { treeFiles, writeTree } = require("../lib/repoSnapshot");
const { computePatch, recordPatch } = require("../lib/patches");
const { fetchCollaborators: fetchGithubCollaborators } = require("../lib/githubRepo");
const { normalizeWorkspaceRoot } = require("../lib/transcripts/util");
const { HOST_TIMEOUT_MS, SEED_TIMEOUT_MS, parsePort } = require("../config/constants");
const { ContextService } = require("./ContextService");

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

    this.discoverState = { at: 0, key: "", rooms: [] };
    this.lastPushedSync = new Map();
    this.tunnelWatchTimer = null;
    this.tunnelMaintainInFlight = null;
    this.lastTunnelProbeAt = 0;
    this.stateTick = null;
    this.lastChatBulkAt = 0;

    this.initListeners();
  }

  get wss() {
    return typeof this.wssRef === "function" ? this.wssRef() : this.wssRef;
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

  async fetchHost(url, pathname, init = {}) {
    const token = init.token === null ? null : init.token || loadRoom()?.memberToken;
    const res = await fetch(`${String(url).replace(/\/$/, "")}${pathname}`, {
      ...init,
      signal: AbortSignal.timeout(init.timeoutMs || HOST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "relay",
        ...(token ? { "x-relay-room-token": token } : {}),
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const err = new Error(`${pathname} ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res;
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
        broadcast(this.wss, payload);
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
      await this.fetchHost(room.url, "/api/room/history", {
        method: "POST",
        timeoutMs: 8000,
        body: JSON.stringify(payload),
      });
    } catch {
      this.lastPushedSync.delete(project.id);
    }
  }

  async pushRoomHistory(room, project, sendToHostFn) {
    return this.pushRoomSnapshot(room, project, { force: false, sendToHostFn });
  }

  async pullRoomHistory(room, project) {
    if (room?.role !== "guest" || !room.url || !room.hostProjectId || !project) return;
    const login = ContextService.currentUser().login;
    const body = await this.fetchHost(
      room.url,
      `/api/room/state?projectId=${encodeURIComponent(room.hostProjectId)}&exclude=${encodeURIComponent(login)}`
    ).then((r) => r.json());
    if (body?.ok) savePeerSnapshot(project.id, "host", body, body.hostLogin || "host");
  }

  notifyCollisionMetrics(project, sendToHostFn) {
    if (!project?.id) return;
    const room = loadRoom(project.path);
    const login = ContextService.currentUser().login || "local";
    const merged = mergeCollisionStats(loadMemory(project.id), { localLogin: login, projectId: project.id });
    if (this.sse) this.sse.emit("metrics", { workspaceId: project.id, collisions: merged });
    if (room?.role === "host" && room.url) this.queueRoomState(project);
    else if (room?.role === "guest" && room.url) this.pushRoomSnapshot(room, project, { force: true, sendToHostFn }).catch(() => undefined);
  }

  bumpCollision(projectId, kind, detail = {}, sendToHostFn) {
    recordCollision(projectId, kind, detail);
    const project = loadRegistry().projects.find((p) => p.id === projectId);
    if (project) this.notifyCollisionMetrics(project, sendToHostFn);
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
      console.log(`[relay-room] host moved to ${signal.url}`);
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
      this.syncRoomLocks();
      return next;
    } catch {
      return room;
    }
  }

  async refreshOpenRooms(project, { force } = {}) {
    const key = repoKeyFromRemote(project?.remoteUrl);
    if (!key) return [];
    if (!force && this.discoverState.key === key && Date.now() - this.discoverState.at < 12_000) return this.discoverState.rooms;
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
    for (const n of require("../lib/notices").listNotices()) {
      if (n.type === "invite" && n.key && !live.has(n.key) && !(current?.roomId && n.key === `invite:${current.roomId}`)) {
        dismissByKey(n.key);
      }
    }
  }

  stopTunnelWatch() {
    if (this.tunnelWatchTimer) clearInterval(this.tunnelWatchTimer);
    this.tunnelWatchTimer = null;
  }

  startTunnelWatch() {
    if (this.tunnelWatchTimer) return;
    this.tunnelWatchTimer = setInterval(() => this.maintainHostTunnel().catch(() => undefined), 12000);
    if (this.tunnelWatchTimer.unref) this.tunnelWatchTimer.unref();
  }

  async publishAndWatch(room, project) {
    let warning = null;
    try {
      const published = await publishSignal(room, {
        repoKey: repoKeyFromRemote(project?.remoteUrl) || room.repoKey,
        hostLogin: ContextService.currentUser().login,
      });
      if (published?.ok && published.gistId && published.gistId !== room.signalGistId) {
        room.signalGistId = published.gistId;
        saveRoom(room, project?.path || room.projectPath);
      } else if (!published?.ok) {
        warning = GIST_SCOPE_HINT;
      }
    } catch {
      warning = GIST_SCOPE_HINT;
    }
    this.startTunnelWatch();
    return warning;
  }

  async maintainHostTunnel() {
    if (this.tunnelMaintainInFlight) return this.tunnelMaintainInFlight;
    this.tunnelMaintainInFlight = this.maintainHostTunnelOnce().finally(() => {
      this.tunnelMaintainInFlight = null;
    });
    return this.tunnelMaintainInFlight;
  }

  async maintainHostTunnelOnce() {
    const project = ContextService.currentProject();
    const room = loadRoom(project?.path);
    if (room?.role !== "host") {
      this.stopTunnelWatch();
      return;
    }
    const port = parsePort(process.argv);
    let listedUrl = null;
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels");
      if (res.ok) {
        const tunnels = (await res.json()).tunnels || [];
        listedUrl =
          (tunnels.find((t) => String(t.public_url || "").startsWith("https://")) || tunnels[0] || {}).public_url || null;
      }
    } catch {
      listedUrl = null;
    }
    let url = listedUrl;
    if (!listedUrl) {
      const now = Date.now();
      if (now - this.lastTunnelProbeAt < 8000) return;
      this.lastTunnelProbeAt = now;
      url = await ensureTunnel(port);
    }
    if (!url) return;
    if (url === room.url && room.live !== false) {
      if (!room.signalGistId) await this.publishAndWatch(room, project);
      return;
    }
    const previous = room.url;
    room.url = url;
    room.live = true;
    saveRoom(room, project?.path);
    const warning = await this.publishAndWatch(room, project);
    if (previous !== url) console.log(`[relay-room] tunnel is ${url}`);
    if (warning) console.warn(`[relay-room] ${warning}`);
    if (previous !== url) {
      if (this.sse) this.sse.emit("presence", { workspaceId: project?.id, tunnel: url });
      broadcast(this.wss, { type: "tunnel", url });
    }
  }

  static defaultJoinDir(name) {
    return path.join(os.homedir(), "Documents", "Relay", String(name || "workspace").replace(/[<>:"|?*]/g, "-"));
  }

  resolveJoinProject(hostMeta, explicitPath) {
    const reg = loadRegistry();
    if (explicitPath) {
      const resolved = normalizeWorkspaceRoot(explicitPath) || explicitPath;
      fs.mkdirSync(resolved, { recursive: true });
      return this.workspaceService ? this.workspaceService.ensureWorkspace(resolved) : null;
    }
    const match =
      (hostMeta.remoteUrl && reg.projects.find((p) => p.remoteUrl && p.remoteUrl === hostMeta.remoteUrl)) ||
      (hostMeta.name && reg.projects.find((p) => p.name === hostMeta.name)) ||
      (hostMeta.pathName && reg.projects.find((p) => path.basename(p.path) === hostMeta.pathName));
    if (match) return match;
    const target = RoomService.defaultJoinDir(hostMeta.pathName || hostMeta.name);
    fs.mkdirSync(target, { recursive: true });
    return this.workspaceService ? this.workspaceService.ensureWorkspace(target) : null;
  }

  async seedFromHost(url, hostProjectId, project, applyingRemote) {
    const snap = await this.fetchHost(url, `/api/snapshot?full=1&projectId=${encodeURIComponent(hostProjectId || "")}`, {
      timeoutMs: SEED_TIMEOUT_MS,
    }).then((r) => r.json());
    if (applyingRemote) applyingRemote.add(project.id);
    let written = [];
    let failed = [];
    try {
      ({ written, failed } = writeTree(project.path, snap.files || []));
    } finally {
      if (applyingRemote) applyingRemote.delete(project.id);
    }
    const session = loadSession();
    for (const file of written) {
      const patch = computePatch({
        workspacePath: project.path,
        file,
        agent: "seed",
        ownerLogin: session.login || "local",
        workspaceId: project.id,
      });
      if (patch) {
        patch.originId = ContextService.originId();
        recordPatch(project.id, patch);
      }
    }
    return { files: written.length, failed: failed.length, truncated: Boolean(snap.truncated) };
  }

  static decodeParam(value) {
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  static splitInviteUrl(raw) {
    const text = String(raw || "").trim();
    const grab = (name) => {
      const m = text.match(new RegExp(`[?&#]${name}=([^&#\\s]+)`));
      return m ? RoomService.decodeParam(m[1]) : null;
    };
    const code = grab("relay_invite");
    const host = grab("relay_host");
    const repo = grab("relay_repo");
    const roomId = grab("relay_room");
    let url = text;
    const first = text.search(/[?&#]relay_(invite|host|repo|room)=/);
    if (first >= 0) url = text.slice(0, first).replace(/[?#]$/, "").replace(/\/$/, "");
    if (!/^https?:\/\//i.test(url)) url = "";
    return { url, code, host, repo, roomId };
  }

  async resolveJoinTarget(body) {
    const parsed = RoomService.splitInviteUrl(body?.url);
    const code = body?.code || parsed.code;
    const hostLogin = body?.hostLogin || parsed.host;
    const repoKey = body?.repoKey || parsed.repo || repoKeyFromRemote(ContextService.currentProject()?.remoteUrl);
    const roomId = body?.roomId || parsed.roomId;
    let url = parsed.url;
    if (!url && body?.url && /^https?:\/\//i.test(String(body.url).trim())) {
      url = String(body.url).replace(/\/$/, "");
    }
    const lookup = () =>
      findSignal({
        gistId: body?.gistId,
        hostLogin,
        repoKey,
        roomId,
      });
    let signal = null;
    if (url) {
      try {
        await this.fetchHost(url, "/api/health", { token: null, timeoutMs: 4000 });
      } catch {
        signal = await lookup().catch(() => null);
        if (signal?.url) url = signal.url;
        else {
          const err = new Error("unreachable");
          err.status = 502;
          throw err;
        }
      }
    } else {
      signal = await lookup();
      if (!signal?.url) return { error: "room_not_found", hint: "The host is not sharing right now." };
      url = signal.url;
    }
    if (!signal && (hostLogin || body?.gistId)) {
      signal = await lookup().catch(() => null);
    }
    return { url, code, signal, hostLogin, repoKey, roomId };
  }
}

module.exports = {
  RoomService,
};
