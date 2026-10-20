"use strict";

const express = require("express");
const {
  loadRoom,
  saveRoom,
  clearRoom,
  share: shareRoom,
  upsertMember,
  dropMember,
  membersView,
  activeMemberLogins,
  roomMaxMembers,
  inviteView,
} = require("../lib/room");
const {
  createInvite,
  revokeInvite,
  redeemInvite,
  markAccepted,
  issueMemberToken,
  revokeMember,
  publicRoom,
  normLogin,
} = require("../lib/roomAuth");
const { loadRegistry, loadMemory } = require("../lib/store");
const { clearPeers, mergeRoomViews } = require("../lib/roomSync");
const { publishSignal, verifyProof, createProof, deleteGist } = require("../lib/roomSignal");
const { dismissByKey } = require("../lib/notices");
const { requireRoomMember, requireLocal } = require("../middleware/authMiddleware");
const { ContextService } = require("../services/ContextService");
const { parsePort, SEED_TIMEOUT_MS } = require("../config/constants");
const admissionLocks = new Map();
async function acquireAdmission(key) {
  const previous = admissionLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  admissionLocks.set(key, current);
  await previous;
  return () => {
    release();
    if (admissionLocks.get(key) === current) admissionLocks.delete(key);
  };
}

function createRoomRoutes({ sse, roomService, lockService, patchService, workspaceService, guestClient }) {
  const router = express.Router();

  function hostRoomFor(projectId) {
    const project = projectId ? loadRegistry().projects.find((p) => p.id === projectId) : ContextService.currentProject();
    const room = loadRoom(project?.path);
    return { project: project || ContextService.currentProject(), room };
  }

  function inviteLink(room, code, project) {
    const base = String(room.url || "").replace(/\/$/, "");
    const u = new URL(`${base}/`);
    u.searchParams.set("latch_invite", code);
    u.searchParams.set("relay_invite", code);
    const host = room.hostLogin || ContextService.currentUser().login;
    const repo = room.repoKey || repoKeyFromRemote(project?.remoteUrl);
    if (host) {
      u.searchParams.set("latch_host", host);
      u.searchParams.set("relay_host", host);
    }
    if (repo) {
      u.searchParams.set("latch_repo", repo);
      u.searchParams.set("relay_repo", repo);
    }
    if (room.roomId) {
      u.searchParams.set("latch_room", room.roomId);
      u.searchParams.set("relay_room", room.roomId);
    }
    return u.toString();
  }

  function repoKeyFromRemote(url) {
    return require("../lib/roomSignal").repoKeyFromRemote(url);
  }

  async function ensureHosting(project) {
    const existing = loadRoom(project?.path);
    if (existing?.role === "guest") {
      return {
        ok: false,
        status: 409,
        error: "already_guest",
        hint: "Leave this room first if you want to host your own.",
      };
    }
    if (existing?.url && existing.role === "host") return { ok: true, room: existing, warning: null };
    const result = await shareRoom(parsePort(process.argv), roomService.shareExtras(project));
    if (!result.ok) return { ...result, status: 503 };
    roomService.syncRoomLocks();
    const warning = await roomService.publishAndWatch(result.room, project);
    return { ok: true, room: loadRoom(project?.path), warning };
  }

  router.get("/api/room", (_req, res) => res.json({ room: publicRoom(loadRoom()) }));

  router.post("/api/room/share", async (req, res) => {
    const project = ContextService.currentProject();
    const existing = loadRoom(project?.path);
    if (existing?.role === "guest") {
      return res.status(409).json({
        error: "already_guest",
        hint: "Leave this room first if you want to host your own.",
      });
    }
    const result = await shareRoom(parsePort(process.argv), roomService.shareExtras(project));
    if (result.ok) {
      roomService.syncRoomLocks();
      result.warning = await roomService.publishAndWatch(result.room, project);
      result.room = publicRoom(loadRoom(project?.path));
    }
    res.status(result.ok ? 200 : 503).json(result);
  });

  router.post("/api/room/hello", requireRoomMember, async (req, res) => {
    const { project } = hostRoomFor(req.body?.hostProjectId);
    const releaseAdmission = await acquireAdmission(project?.path || req.body?.hostProjectId || "default");
    try {
      const room = loadRoom(project?.path);
      if (!room?.url) return res.status(409).json({ error: "no_room" });
      const user = req.body?.user;
      if (!user?.login) return res.status(400).json({ error: "user_required" });
      const next = upsertMember(room, user, req.body?.role === "host" ? "host" : "guest");
      const active = workspaceService && project ? workspaceService.activeAgent(project.id) : {};
      upsertMember(next, { ...ContextService.currentUser(), ...active }, "host");
      saveRoom(next, project?.path);
      if (sse) sse.emit("presence", { workspaceId: project?.id, userId: user.login });
      res.json({
        ok: true,
        members: membersView(next),
        hostProjectId: room.hostProjectId || project?.id || null,
        hostWorkspacePath: room.hostWorkspacePath || project?.path || null,
        hostLogin: ContextService.currentUser().login,
        project: project
          ? { id: project.id, name: project.name, pathName: require("path").basename(project.path), remoteUrl: project.remoteUrl }
          : null,
      });
    } finally {
      releaseAdmission();
    }
  });

  router.post("/api/room/invite", requireLocal, async (req, res) => {
    const project = ContextService.currentProject();
    const hosted = await ensureHosting(project);
    if (!hosted.ok) return res.status(hosted.status || 409).json(hosted);
    const room = hosted.room;
    const login = normLogin(req.body?.login);
    if (!login) return res.status(400).json({ error: "login_required" });
    const check = await ContextService.collaboratorCheck(project, login);
    const { ok, invite, code, error } = createInvite(room, { login, invitedBy: ContextService.currentUser().login });
    if (!ok) return res.status(400).json({ error });
    saveRoom(room, project?.path);
    const warning = (await roomService.publishAndWatch(room, project)) || hosted.warning;
    res.status(201).json({
      ok: true,
      invite: inviteView(room).find((i) => i.id === invite.id),
      code,
      link: inviteLink(room, code, project),
      collaborator: check,
      warning,
      room: publicRoom(loadRoom(project?.path)),
    });
  });

  router.get("/api/room/invites", requireLocal, (req, res) => {
    const room = loadRoom(ContextService.currentProject()?.path);
    res.json({ invites: room ? inviteView(room) : [], open: Boolean(room?.open) });
  });

  router.post("/api/room/invites/:id/revoke", requireLocal, (req, res) => {
    const project = ContextService.currentProject();
    const room = loadRoom(project?.path);
    if (!room?.url) return res.status(409).json({ error: "not_hosting" });
    const result = revokeInvite(room, req.params.id);
    if (!result.ok) return res.status(404).json(result);
    saveRoom(room, project?.path);
    res.json({ ok: true, invites: inviteView(room) });
  });

  router.post("/api/room/kick", requireLocal, async (req, res) => {
    const project = ContextService.currentProject();
    const releaseAdmission = await acquireAdmission(project?.path || "default");
    try {
    const room = loadRoom(project?.path);
    if (!room?.url) return res.status(409).json({ error: "not_hosting" });
    const login = normLogin(req.body?.login);
    if (!login) return res.status(400).json({ error: "login_required" });
    revokeMember(room, login);
    saveRoom(dropMember(room, login), project?.path);
    if (sse) sse.emit("presence", { workspaceId: project?.id, userId: login, left: true });
    if (roomService.noticeService) {
      roomService.noticeService.emitNotice(
        {
          type: "left",
          key: `left:${room.roomId || "room"}:${String(login).toLowerCase()}`,
          title: `@${login} left the room`,
          body: "Removed from the shared room — they stay on the GitHub team list.",
          workspaceId: project?.id || null,
          payload: { login },
        },
        { revive: true }
      );
    }
    res.json({ ok: true, members: membersView(loadRoom(project?.path)), invites: inviteView(room) });
    } finally {
      releaseAdmission();
    }
  });

  router.post("/api/room/redeem", async (req, res) => {
    const project = ContextService.currentProject();
    const releaseAdmission = await acquireAdmission(project?.path || "default");
    try {
    let room = loadRoom(project?.path);
    if (!room?.url || room.role !== "host") return res.status(409).json({ error: "not_hosting" });
    const user = req.body?.user;
    if (!user?.login) return res.status(400).json({ error: "user_required" });

    if (!room.open) {
      const code = req.body?.code;
      const proofGistId = req.body?.proofGistId;
      const check = await ContextService.collaboratorCheck(project, user.login);

      if (code) {
        const redeemed = redeemInvite(room, code, user.login);
        if (!redeemed.ok && !check.allowed) {
          return res.status(403).json({
            error: redeemed.reason,
            invitedLogin: redeemed.invitedLogin,
            hint:
              redeemed.reason === "invite_wrong_user"
                ? `That invite was issued to @${redeemed.invitedLogin}.`
                : "Ask the host to invite you from the Team tab.",
          });
        }
        if (redeemed.ok && !redeemed.rejoin) markAccepted(redeemed.invite, user.login);
      } else if (!check.allowed) {
        if (!proofGistId || !room.roomId || !room.nonce) {
          return res.status(403).json({
            error: "invite_required",
            hint: "This room is invite-only. Ask the host to invite you from the Team tab.",
          });
        }
        const proof = await verifyProof({
          gistId: proofGistId,
          roomId: room.roomId,
          nonce: room.nonce,
          login: user.login,
        });
        if (!proof.ok) {
          return res.status(403).json({
            error: proof.reason,
            hint: "Could not verify your GitHub identity. Ask the host to invite you from the Team tab.",
          });
        }
      }
    }

    let token;
      const host = { ...ContextService.currentUser(), ...(workspaceService && project ? workspaceService.activeAgent(project.id) : {}) };
      upsertMember(room, host, "host");
      const maxMembers = roomMaxMembers(room, project);
      room.maxMembers = Number.isInteger(maxMembers) && maxMembers >= 1 ? maxMembers : 7;
      const existingMember = (room.members || []).some((member) => normLogin(member.login) === normLogin(user.login));
      const activeCount = activeMemberLogins(room).size;
      if (!existingMember && activeCount >= room.maxMembers) {
        return res.status(409).json({
          error: "room_member_limit_reached",
          maxMembers: room.maxMembers,
          activeMembers: activeCount,
        });
      }

      token = issueMemberToken(room, user.login);
      upsertMember(room, user, "guest");
      saveRoom(room, project?.path);
    if (sse) sse.emit("presence", { workspaceId: project?.id, userId: user.login });
    console.log(`[latch-room] @${user.login} joined the room`);
    if (roomService.noticeService) {
      roomService.noticeService.emitNotice(
        {
          type: "joined",
          key: `joined:${room.roomId || "room"}:${String(user.login).toLowerCase()}`,
          title: `@${user.login} joined the room`,
          body: `They're in ${project?.name || "this workspace"} with you.`,
          workspaceId: project?.id || null,
          payload: { login: user.login, roomId: room.roomId || null },
        },
        { revive: true }
      );
    }
    res.json({
      ok: true,
      token,
      roomId: room.roomId || null,
      members: membersView(room),
      hostProjectId: room.hostProjectId || project?.id || null,
      hostWorkspacePath: room.hostWorkspacePath || project?.path || null,
      hostLogin: ContextService.currentUser().login,
      project: project
        ? { id: project.id, name: project.name, pathName: require("path").basename(project.path), remoteUrl: project.remoteUrl }
        : null,
    });
    } finally {
      releaseAdmission();
    }
  });

  router.get("/api/room/members", requireRoomMember, (req, res) => {
    const { room } = hostRoomFor(req.query.projectId);
    res.json({ members: membersView(room) });
  });

  router.post("/api/room/bye", requireRoomMember, async (req, res) => {
    const { project } = hostRoomFor(req.body?.hostProjectId);
    const releaseAdmission = await acquireAdmission(project?.path || "default");
    try {
    const room = loadRoom(project?.path);
    if (!room?.url || !req.body?.login) return res.json({ ok: true });
    saveRoom(dropMember(room, req.body.login), project?.path);
    if (sse) sse.emit("presence", { workspaceId: project?.id, userId: req.body.login, left: true });
    if (roomService.noticeService) {
      roomService.noticeService.emitNotice(
        {
          type: "left",
          key: `left:${room.roomId || "room"}:${String(req.body.login).toLowerCase()}`,
          title: `@${req.body.login} left the room`,
          body: "They disconnected from the shared coordinator.",
          workspaceId: project?.id || null,
        },
        { revive: true }
      );
    }
    res.json({ ok: true });
    } finally {
      releaseAdmission();
    }
  });

  router.get("/api/room/state", requireRoomMember, (req, res) => {
    const project = req.query.projectId
      ? loadRegistry().projects.find((p) => p.id === req.query.projectId) || ContextService.currentProject()
      : ContextService.currentProject();
    if (!project) return res.status(404).json({ error: "no_local_repo" });
    const login = ContextService.currentUser().login || "local";
    const memory = loadMemory(project.id);
    const view = mergeRoomViews(memory, { exclude: req.query.exclude || null });
    res.json({
      ok: true,
      hostLogin: login,
      projectId: project.id,
      lastTranscriptSyncAt: memory.lastTranscriptSyncAt || 0,
      chats: view.chats,
      timeline: view.timeline,
      activity: view.activity,
      edits: view.edits,
      agents: view.agents,
      stats: memory.stats || {},
      roomCollisions: require("../lib/collisionMetrics").mergeCollisionStats(memory, {
        localLogin: login,
        exclude: req.query.exclude || null,
        projectId: project.id,
      }),
    });
  });

  router.post("/api/room/history", requireRoomMember, (req, res) => {
    const project = req.body?.projectId
      ? loadRegistry().projects.find((p) => p.id === req.body.projectId) || ContextService.currentProject()
      : ContextService.currentProject();
    if (!project) return res.status(404).json({ error: "no_local_repo" });
    const login = String(req.body?.login || "").trim();
    if (!login) return res.status(400).json({ error: "login_required" });
    roomService.ingestPeerHistory(login, req.body?.snapshot, project);
    res.json({ ok: true });
  });

  router.post("/api/room/adopt", (req, res) => {
    const url = String(req.body?.url || "").replace(/\/$/, "");
    if (!url) return res.status(400).json({ error: "url required" });
    const project = ContextService.currentProject();
    const room = saveRoom(
      upsertMember(
        {
          role: "host",
          url,
          hostProjectId: project?.id || null,
          hostWorkspacePath: project?.path || null,
          hostProjectName: project?.name || null,
          projectId: project?.id || null,
          projectPath: project?.path || null,
          startedAt: new Date().toISOString(),
          members: [],
        },
        ContextService.currentUser(),
        "host"
      ),
      project?.path
    );
    roomService.syncRoomLocks();
    res.json({ ok: true, room });
  });

  router.get("/api/room/discover", requireLocal, async (_req, res) => {
    const project = ContextService.currentProject();
    try {
      const rooms = await roomService.refreshOpenRooms(project);
      res.json({ ok: true, rooms });
    } catch (err) {
      res.json({ ok: false, rooms: [], error: String(err.message || err) });
    }
  });

  router.post("/api/room/join", async (req, res) => {
    const target = await roomService
      .resolveJoinTarget(req.body || {})
      .catch((err) => ({ error: "unreachable", detail: String(err.message || err) }));
    if (target.error) {
      return res.status(target.error === "room_not_found" ? 404 : 502).json(target);
    }
    const { url, code, signal } = target;
    const seed = req.body?.seed !== false;
    try {
      const health = await roomService.fetchHost(url, "/api/health", { token: null }).then((r) => r.json());
      let proofGistId = null;
      try {
        if (signal?.nonce && signal?.roomId) {
          proofGistId = await createProof({
            roomId: signal.roomId,
            nonce: signal.nonce,
            login: ContextService.currentUser().login,
          });
        }
      } catch {
        /* ignore */
      }

      let admission;
      try {
        admission = await roomService
          .fetchHost(url, "/api/room/redeem", {
            token: null,
            method: "POST",
            body: JSON.stringify({ code, user: ContextService.currentUser(), proofGistId }),
          })
          .then((r) => r.json());
      } catch (err) {
        if (err.status === 403 || err.status === 409) {
          const detail = await fetch(`${url}/api/room/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "relay" },
            body: JSON.stringify({ code, user: ContextService.currentUser(), proofGistId }),
          })
            .then((r) => r.json())
            .catch(() => ({}));
          return res.status(403).json({
            error: detail.error || "invite_required",
            hint: detail.hint || "This room is invite-only. Ask the host to invite you from the Team tab.",
          });
        }
        throw err;
      } finally {
        if (proofGistId) deleteGist(proofGistId).catch(() => undefined);
      }

      const hostProject = admission.project || null;
      const hostMeta = {
        remoteUrl: hostProject?.remoteUrl || null,
        name: hostProject?.name || null,
        pathName: hostProject?.pathName || hostProject?.name || null,
      };
      const project = roomService.resolveJoinProject(hostMeta, req.body?.path);
      if (!project) return res.status(400).json({ error: "no_local_workspace" });

      const room = saveRoom(
        {
          role: "guest",
          url,
          memberToken: admission.token || null,
          roomId: admission.roomId || signal?.roomId || null,
          signalGistId: signal?.gistId || null,
          repoKey: signal?.repoKey || repoKeyFromRemote(hostMeta.remoteUrl) || target.repoKey || null,
          hostProjectId: admission.hostProjectId || health.room?.hostProjectId || null,
          hostWorkspacePath: admission.hostWorkspacePath || health.room?.hostWorkspacePath || null,
          hostProjectName: hostMeta.name,
          hostLogin: admission.hostLogin || signal?.hostLogin || target.hostLogin || null,
          projectId: project.id,
          projectPath: project.path,
          startedAt: new Date().toISOString(),
          members: Array.isArray(admission.members) ? admission.members : [],
        },
        project.path
      );

      if (guestClient) {
        guestClient.connectHostPatches(room);
        guestClient.connectHostControl(room);
      }
      roomService.syncRoomLocks();

      let seeded = null;
      if (seed) {
        try {
          seeded = await roomService.seedFromHost(url, room.hostProjectId, project, patchService.applyingRemote);
        } catch (err) {
          seeded = { error: String(err.message || err) };
        }
      }

      const pulled = [];
      try {
        const snap = await roomService
          .fetchHost(url, "/api/snapshot", { timeoutMs: SEED_TIMEOUT_MS })
          .then((r) => r.json());
        const hint = { remoteUrl: snap.remoteUrl, name: snap.name, pathName: snap.pathName };
        for (const patch of snap.patches || []) {
          const result = patchService.acceptPeerPatch(patch, hint, { skipIfOrigin: true });
          if (result.applied) pulled.push(patch.file);
        }
      } catch {
        /* ignore */
      }

      try {
        await roomService.pullRoomHistory(room, project);
      } catch {
        /* ignore */
      }
      roomService.pushRoomHistory(room, project, (obj) => guestClient?.sendToHost(obj)).catch(() => undefined);
      if (workspaceService) workspaceService.publishGraph(project);
      if (sse) sse.emit("projects", { projects: loadRegistry().projects });
      if (room.roomId) dismissByKey(`invite:${room.roomId}`);
      if (roomService.noticeService) {
        roomService.noticeService.emitNotice({
          type: "joined",
          key: `in:${room.roomId || "room"}`,
          title: `You're in @${room.hostLogin || "host"}'s room`,
          body: room.hostProjectName ? `Sharing ${room.hostProjectName}.` : "Locks and live patches are shared.",
          workspaceId: project.id,
        });
      }

      res.json({ ok: true, room: publicRoom(room), project, seeded, pulled });
    } catch (err) {
      res.status(502).json({ error: "unreachable", detail: String(err.message || err) });
    }
  });

  router.post("/api/room/leave", async (_req, res) => {
    const room = loadRoom();
    if (room?.role === "host") {
      roomService.stopTunnelWatch();
      try {
        await publishSignal(
          { ...room, live: false },
          {
            repoKey: room.repoKey || repoKeyFromRemote(ContextService.currentProject()?.remoteUrl),
            hostLogin: ContextService.currentUser().login,
          }
        );
      } catch {
        /* ignore */
      }
    }
    if (room?.role === "guest" && room.url) {
      await roomService
        .fetchHost(room.url, "/api/room/bye", {
          method: "POST",
          body: JSON.stringify({ login: ContextService.currentUser().login, hostProjectId: room.hostProjectId }),
        })
        .catch(() => undefined);
    }
    clearRoom(ContextService.currentProject()?.path);
    for (const p of loadRegistry().projects) {
      clearRoom(p.path);
      clearPeers(p.id);
    }
    roomService.lastPushedSync.clear();
    roomService.roomLocks.start(null);
    if (guestClient) guestClient.stop();
    res.json({ ok: true, room: null });
  });

  return router;
}

module.exports = {
  createRoomRoutes,
};
