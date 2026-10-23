"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const { loadRegistry, saveRegistry, loadSession, saveSession, loadMemory, projectDir } = require("../lib/store");
const { buildDashboard } = require("../lib/dashboard");
const { cloneRepo, addLocal, detectRemoteUrl } = require("../lib/cloneRepo");
const { syncTranscriptsQueued } = require("../lib/transcripts/sync");
const { pushLocalEdits, pullCentralChanges } = require("../lib/centralSync");
const { detectConflicts } = require("../lib/conflicts");
const { graphFor, rebuild } = require("../lib/depGraph");
const { rewindTo, computePatch } = require("../lib/patches");
const { loadRoom, saveRoom, upsertMember, membersView } = require("../lib/room");
const { publicRoom, isRemoteRequest, inviteView } = require("../lib/roomAuth");
const { dirtyFiles } = require("../lib/dirtyFiles");
const { treeFiles } = require("../lib/repoSnapshot");
const { compileRoomAsk } = require("../lib/roomAsk");
const { mergeRoomViews } = require("../lib/roomSync");
const { fetchCollaborators: fetchGithubCollaborators, peekCollaborators } = require("../lib/githubRepo");
const { repoKeyFromRemote } = require("../lib/roomSignal");
const { requireRoomMember } = require("../middleware/authMiddleware");
const { ContextService } = require("../services/ContextService");
const { SEED_TIMEOUT_MS } = require("../config/constants");

function createProjectRoutes({
  sse,
  watcher,
  lockTable,
  lockService,
  patchService,
  roomService,
  transcriptService,
  workspaceService,
  guestClient,
}) {
  const router = express.Router();

  router.get("/api/projects", (_req, res) => {
    res.json({ projects: loadRegistry().projects });
  });

  router.post("/api/projects", async (req, res) => {
    const { name, path: workspacePath, remoteUrl, mode } = req.body || {};
    try {
      let project;
      if (mode === "clone") {
        if (!remoteUrl) return res.status(400).json({ error: "remoteUrl required" });
        const out = await cloneRepo(remoteUrl, workspacePath);
        project = out.project;
        if (name && name !== project.name) {
          project.name = name;
          const reg = loadRegistry();
          const row = reg.projects.find((p) => p.id === project.id);
          if (row) row.name = name;
          saveRegistry(reg);
        }
      } else {
        if (!workspacePath) return res.status(400).json({ error: "path required" });
        project = addLocal(workspacePath, name);
      }
      if (watcher) watcher.watch(project.path, project.id);
      if (sse) sse.emit("projects", { projects: loadRegistry().projects });
      res.status(201).json({ project });
    } catch (err) {
      res.status(400).json({ error: String(err.message || err) });
    }
  });

  router.get("/api/projects/:id", (req, res) => {
    const project = loadRegistry().projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    res.json({ project });
  });

  router.patch("/api/projects/:id", (req, res) => {
    const reg = loadRegistry();
    const project = reg.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    if (req.body?.name) project.name = req.body.name;
    saveRegistry(reg);
    res.json({ project });
  });

  router.delete("/api/projects/:id", (req, res) => {
    const mode = String(req.query.mode || req.body?.mode || "leave");
    const reply = (nextId) => res.json({ ok: true, mode, nextId: nextId || null });
    try {
      const reg = loadRegistry();
      const idx = reg.projects.findIndex((p) => p.id === req.params.id);
      if (idx < 0) return res.status(404).json({ ok: false, error: "not_found", nextId: null });
      const project = reg.projects[idx];
      try {
        if (project.path && watcher) watcher.unwatch(project.path);
      } catch {
        /* ignore */
      }
      if (transcriptService) transcriptService.stopTranscriptWatch(project.id);
      reg.projects.splice(idx, 1);
      saveRegistry(reg);
      if (mode === "remove") {
        try {
          fs.rmSync(projectDir(project.id), { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
      const session = loadSession();
      if (session.projectId === project.id) {
        session.projectId = reg.projects[0]?.id || null;
        saveSession(session);
      }
      try {
        if (sse) sse.emit("projects", { projects: reg.projects });
      } catch {
        /* ignore */
      }
      return reply(session.projectId || reg.projects[0]?.id || null);
    } catch {
      try {
        const reg = loadRegistry();
        const idx = reg.projects.findIndex((p) => p.id === req.params.id);
        if (idx >= 0) {
          const project = reg.projects[idx];
          if (transcriptService) transcriptService.stopTranscriptWatch(project.id);
          try {
            if (project.path && watcher) watcher.unwatch(project.path);
          } catch {
            /* ignore */
          }
          reg.projects.splice(idx, 1);
          saveRegistry(reg);
          const session = loadSession();
          if (session.projectId === project.id) {
            session.projectId = reg.projects[0]?.id || null;
            saveSession(session);
          }
          return reply(session.projectId || reg.projects[0]?.id || null);
        }
        return reply(loadSession().projectId || loadRegistry().projects[0]?.id || null);
      } catch {
        return reply(null);
      }
    }
  });

  router.post("/api/projects/:id/select", (req, res) => {
    const project = loadRegistry().projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    saveSession({ ...loadSession(), projectId: project.id });
    res.json({ project, dashboard: buildDashboard(project) });
  });

  router.post("/api/projects/:id/sync", async (req, res) => {
    const project = loadRegistry().projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    const memory = await syncTranscriptsQueued(project, {
      ownerLogin: loadSession().login || "local",
    });
    project.lastSyncAt = Date.now();
    const reg = loadRegistry();
    const idx = reg.projects.findIndex((p) => p.id === project.id);
    reg.projects[idx] = project;
    saveRegistry(reg);
    Promise.all([
      pushLocalEdits(project.path, project.id, memory),
      pullCentralChanges(project.path),
    ])
      .then(() => sse && sse.emit("history", { workspaceId: project.id, lastSyncAt: project.lastSyncAt }))
      .catch(() => sse && sse.emit("history", { workspaceId: project.id, lastSyncAt: project.lastSyncAt }));
    if (workspaceService) workspaceService.publishGraph(project);
    res.json({
      ok: true,
      lastSyncAt: project.lastSyncAt,
      chats: (memory.chats || []).length,
      history: (memory.history || []).length,
    });
  });

  router.get("/api/projects/:id/dashboard", async (req, res) => {
    try {
      const project = loadRegistry().projects.find((p) => p.id === req.params.id);
      if (!project) return res.status(404).json({ error: "not_found" });
    const room = loadRoom(project.path);
    if (room?.url) {
      roomService.syncRoomLocks(project.path);
      const live =
        room.role === "guest"
          ? guestClient?.hostWireOpen()
          : Boolean(roomService.wss && [...roomService.wss.clients].some((c) => c.readyState === 1));
      if (!live) {
        roomService.pullRoomHistory(room, project).catch(() => undefined);
        roomService.pushRoomHistory(room, project, (obj) => guestClient?.sendToHost(obj)).catch(() => undefined);
      }
    }
    const dashboard = buildDashboard(project);
    dashboard.locks = lockService.locksFor({ id: project.id, path: project.path });
    dashboard.reads = lockService.readsFor({ id: project.id, path: project.path });
    const graph = fs.existsSync(project.path) ? graphFor(project.path) : null;
    const lockedFiles = dashboard.locks
      .filter((l) => !l.released)
      .map((l) => (l.filePath.includes("::") ? l.filePath.split("::")[1] : l.filePath));
    dashboard.graph = graph
      ? graph.snapshot(lockedFiles)
      : { nodes: [], edges: [], cycles: [], unresolvable: [], fileCount: 0, edgeCount: 0, lockDepth: 1 };
    const mem = loadMemory(project.id);
    dashboard.patches = patchService.patchRows(mem.patches || mem.edits || []);
    dashboard.lastAppliedLamport = mem.lastAppliedLamport || 0;
    let roomMembers = [];
    if (room?.role === "host") {
      saveRoom(
        upsertMember(
          room,
          { ...ContextService.currentUser(), ...(workspaceService ? workspaceService.activeAgent(project.id) : {}) },
          "host"
        ),
        project.path
      );
      roomMembers = membersView(loadRoom(project.path));
    }
    if (room?.role === "guest" && room.url) {
      roomMembers = membersView(loadRoom(project.path));
      roomService
        .announceToHost(room)
        .then((hello) => {
          const roster = Array.isArray(hello?.members) && hello.members.length ? hello.members : null;
          if (roster) roomService.rememberRoster(project.path, roster);
        })
        .catch(() => {
          roomService
            .refreshGuestRoom(room)
            .then((next) => {
              if (next?.url && next.url !== room.url && guestClient) {
                guestClient.connectHostPatches(next);
                guestClient.connectHostControl(next);
              }
            })
            .catch(() => undefined);
        });
      if (room.hostProjectId) {
        roomService
          .fetchHost(room.url, `/api/projects/${room.hostProjectId}/graph`)
          .then((r) => r.json())
          .then((remoteGraph) => {
            if (remoteGraph?.nodes && sse) sse.emit("graph", { workspaceId: project.id, graph: remoteGraph });
          })
          .catch(() => undefined);
      }
    }
    if (!project.remoteUrl) {
      const detected = detectRemoteUrl(project.path);
      if (detected) {
        project.remoteUrl = detected;
        const reg = loadRegistry();
        const idx = reg.projects.findIndex((p) => p.id === project.id);
        if (idx >= 0) {
          reg.projects[idx] = project;
          saveRegistry(reg);
        }
      }
    }
    if (room?.url) {
      const me = ContextService.currentUser();
      const myRole = room.role === "host" ? "host" : "guest";
      const mine = {
        ...me,
        role: myRole,
        online: true,
        ...(workspaceService ? workspaceService.activeAgent(project.id) : {}),
      };
      const rest = roomMembers.filter((c) => !ContextService.sameLogin(c.login, me.login));
      const previous = roomMembers.find((c) => ContextService.sameLogin(c.login, me.login));
      roomMembers = [{ ...previous, ...mine }, ...rest];
    }
    let ghCollaborators = peekCollaborators(project.remoteUrl) || [];
    fetchGithubCollaborators(project.remoteUrl).catch(() => []);
    dashboard.collaborators = ContextService.overlayTeam(ghCollaborators, roomMembers);
    const health = roomService.roomLocks.health;
    dashboard.room = publicRoom(room)
      ? { ...publicRoom(room), hostReachable: health.reachable, lastHostContactAt: health.lastContactAt }
      : null;
    dashboard.invites = room?.role === "host" && !isRemoteRequest(req) ? inviteView(room) : [];
    dashboard.openRooms =
      !isRemoteRequest(req) && roomService.discoverState.key === repoKeyFromRemote(project.remoteUrl)
        ? roomService.discoverState.rooms
        : [];
    if (!isRemoteRequest(req) && room?.role !== "host") {
      roomService
        .refreshOpenRooms(project)
        .then((rooms) => {
          if (rooms.length && sse) sse.emit("presence", { workspaceId: project.id, openRooms: true });
        })
        .catch(() => undefined);
    }
      res.json(dashboard);
    } catch (err) {
      console.error(`[latch] dashboard error for ${req.params?.id}:`, err?.stack || err?.message || err);
      res.status(500).json({ error: "dashboard_error", detail: err?.message || String(err), stack: err?.stack });
    }
  });

  router.get("/api/projects/:id/graph", requireRoomMember, (req, res) => {
    const project = loadRegistry().projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    const g = graphFor(project.path) || rebuild(project.path);
    const lockedFiles = lockTable.list({ id: project.id, path: project.path }).map((l) =>
      l.filePath.includes("::") ? l.filePath.split("::")[1] : l.filePath
    );
    res.json(g ? g.snapshot(lockedFiles) : { nodes: [], edges: [] });
  });

  router.get("/api/projects/:id/history", (req, res) => {
    const project = loadRegistry().projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    const memory = loadMemory(project.id);
    delete memory.ir;
    res.json({
      history: memory.history || [],
      chats: memory.chats || [],
      timeline: memory.timeline || [],
    });
  });

  router.get("/api/projects/:id/conflicts", (req, res) => {
    const project = loadRegistry().projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    res.json({ conflicts: detectConflicts(loadMemory(project.id)) });
  });

  router.get("/api/projects/:id/patches", (req, res) => {
    const project = loadRegistry().projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    const memory = loadMemory(project.id);
    res.json({ patches: memory.patches || [], lastAppliedLamport: memory.lastAppliedLamport || 0 });
  });

  router.post("/api/projects/:id/rewind", (req, res) => {
    const project = loadRegistry().projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    const lamport = Number(req.body?.lamport || 0);
    patchService.applyingRemote.add(project.id);
    const result = rewindTo(project.id, project.path, lamport);
    patchService.applyingRemote.delete(project.id);
    if (sse) sse.emit("rewind", { workspaceId: project.id, lamport, count: result.patches.length });
    res.json({ ok: true, ...result });
  });

  router.get("/api/snapshot", requireRoomMember, (req, res) => {
    const project = req.query.projectId
      ? loadRegistry().projects.find((p) => p.id === req.query.projectId) || ContextService.currentProject()
      : req.query.path
        ? ContextService.projectForPath(req.query.path, (p) => workspaceService?.ensureWorkspace(p))
        : ContextService.currentProject();
    if (!project) return res.status(404).json({ error: "no_local_repo" });
    const session = loadSession();
    if (req.query.full === "1" || req.query.full === "true") {
      const { files, truncated } = treeFiles(project.path);
      return res.json({
        ok: true,
        full: true,
        remoteUrl: project.remoteUrl,
        name: project.name,
        pathName: path.basename(project.path),
        workspacePath: project.path,
        files,
        truncated,
      });
    }
    const patches = dirtyFiles(project.path)
      .map((file) =>
        computePatch({
          workspacePath: project.path,
          file,
          agent: "snapshot",
          ownerLogin: session.login || "local",
          workspaceId: project.id,
        })
      )
      .filter(Boolean)
      .map((patch) => {
        patch.originId = ContextService.originId();
        patch.originAgentId = ContextService.originId();
        return patch;
      });
    res.json({
      ok: true,
      remoteUrl: project.remoteUrl,
      name: project.name,
      pathName: path.basename(project.path),
      patches,
    });
  });

  router.post("/api/ask", async (req, res) => {
    const project = req.body?.workspacePath
      ? ContextService.projectForPath(req.body.workspacePath, (p) => workspaceService?.ensureWorkspace(p))
      : ContextService.currentProject();
    if (!project) return res.status(404).json({ error: "no_local_repo" });
    const limit = Math.min(80, Math.max(5, Number(req.body?.limit) || 30));
    const writeFile = req.body?.write !== false;
    const room = loadRoom(project.path);
    try {
      await syncTranscriptsQueued(project, { ownerLogin: ContextService.currentUser().login || "local" });
    } catch {
      /* ignore */
    }
    if (room?.role === "guest" && room.url) {
      await roomService.pullRoomHistory(room, project).catch(() => undefined);
    }
    const memory = loadMemory(project.id);
    const view = mergeRoomViews(memory);
    const user = ContextService.currentUser();
    const brief = compileRoomAsk({
      view,
      room,
      login: user.login,
      locks: lockService.locksFor({ id: project.id, path: project.path }),
      limit,
    });
    let written = null;
    if (writeFile) {
      const latchOut = path.join(project.path, ".latch", "latch_ask.md");
      const relayOut = path.join(project.path, ".relay", "relay_ask.md");
      try {
        fs.mkdirSync(path.dirname(latchOut), { recursive: true });
        fs.writeFileSync(latchOut, brief.markdown);
        if (fs.existsSync(path.dirname(relayOut))) {
          try {
            fs.writeFileSync(relayOut, brief.markdown);
          } catch {
            /* ignore */
          }
        }
        written = latchOut;
      } catch (err) {
        return res.status(500).json({ error: "write_failed", detail: String(err.message || err) });
      }
    }
    res.json({ ok: true, written, markdown: brief.markdown, data: brief.json });
  });

  router.post("/api/push", (req, res) => {
    const project = req.body?.workspacePath
      ? ContextService.projectForPath(req.body.workspacePath, (p) => workspaceService?.ensureWorkspace(p))
      : ContextService.currentProject();
    if (!project) return res.status(404).json({ error: "no_local_repo" });
    const files = dirtyFiles(project.path);
    const flushed = files.map((file) => patchService.fanOutLocalFile(project, file, ContextService.originId()));
    res.json({
      ok: true,
      files: flushed.filter((r) => r.flushed).map((r) => r.file),
      skipped: flushed.filter((r) => !r.flushed).length,
    });
  });

  router.post("/api/pull", async (req, res) => {
    const project = req.body?.workspacePath
      ? ContextService.projectForPath(req.body.workspacePath, (p) => workspaceService?.ensureWorkspace(p))
      : ContextService.currentProject();
    const room = loadRoom(project?.path);
    if (!room?.url) return res.status(400).json({ error: "not_in_a_room", hint: "Join a shared room first" });
    if (room.role === "host") {
      return res.json({ ok: true, files: [], note: "host already has the working tree" });
    }
    try {
      const snap = await fetch(`${room.url.replace(/\/$/, "")}/api/snapshot`).then((r) => r.json());
      const hint = { remoteUrl: snap.remoteUrl, name: snap.name, pathName: snap.pathName };
      const applied = [];
      for (const patch of snap.patches || []) {
        const result = patchService.acceptPeerPatch(patch, hint, { skipIfOrigin: true });
        if (result.applied) applied.push(patch.file);
      }
      res.json({ ok: true, files: applied });
    } catch (err) {
      res.status(502).json({ error: "unreachable", detail: String(err.message || err) });
    }
  });

  return router;
}

module.exports = {
  createProjectRoutes,
};
