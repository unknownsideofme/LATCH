"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const { loadRegistry, loadSession, loadMemory, saveMemory, id } = require("../lib/store");
const { homeLatchDir, homeRelayDir } = require("../lib/paths");
const { appendStopTurn } = require("../lib/memorySync");
const { harvest } = require("../lib/harvest");
const { syncTranscriptsQueued } = require("../lib/transcripts/sync");
const { pushLocalEdits, pullCentralChanges } = require("../lib/centralSync");
const { loadRoom } = require("../lib/room");
const { ContextService } = require("../services/ContextService");

function createAgentRoutes({ sse, watcher, presence, lockTable, lockService, workspaceService, roomService }) {
  const router = express.Router();

  router.post("/api/ensure-workspace", (req, res) => {
    const project = workspaceService.ensureWorkspace(req.body?.workspacePath);
    if (!project) return res.status(400).json({ error: "workspace_path_required" });
    res.json({ ok: true, project });
  });

  router.post("/api/ingest-stop", async (req, res) => {
    const { workspacePath, agent, ownerLogin, sessionId, messages, edits, transcript_path } = req.body || {};
    const project = workspaceService.ensureWorkspace(workspacePath);
    if (!project) return res.status(400).json({ error: "workspace_path_required" });
    const login = ownerLogin || loadSession().login || "local";
    const memory = await syncTranscriptsQueued(project, {
      ownerLogin: login,
      hint: {
        agent,
        sessionId,
        conversationId: req.body?.conversationId,
        transcript_path,
      },
    });
    if (!(memory.history || []).length && ((messages && messages.length) || (edits && edits.length))) {
      const harvested = harvest({
        transcript_path,
        sessionId,
        conversationId: req.body?.conversationId,
      });
      appendStopTurn(project.id, {
        agent: agent || "Agent",
        ownerLogin: login,
        sessionId,
        messages: (messages && messages.length ? messages : harvested.messages) || [],
        edits: (edits && edits.length ? edits : harvested.edits) || [],
      });
    }
    if (sse) sse.emit("history", { workspaceId: project.id, lastSyncAt: Date.now() });
    pushLocalEdits(project.path, project.id, loadMemory(project.id))
      .then(() => pullCentralChanges(project.path))
      .catch(() => undefined);
    roomService.pushRoomHistory(loadRoom(project.path), project).catch(() => undefined);
    workspaceService.publishGraph(project);
    res.json({
      ok: true,
      harvested: Boolean((memory.history || []).length),
      chats: (memory.chats || []).length,
      history: (memory.history || []).length,
    });
  });

  router.post("/api/handshake", (req, res) => {
    const { projectId, agent } = req.body || {};
    const project = loadRegistry().projects.find((p) => p.id === projectId) || ContextService.currentProject();
    if (!project) return res.status(404).json({ error: "no_project" });
    const memory = loadMemory(project.id);
    const row = memory.agents.find((a) => a.label === agent || a.id === agent);
    if (row) {
      row.status = "handshaking";
      row.lastActiveAt = Date.now();
    }
    saveMemory(project.id, memory);
    const token = id("hs");
    try {
      const latchDir = path.join(project.path, ".latch");
      const relayDir = path.join(project.path, ".relay");
      fs.mkdirSync(latchDir, { recursive: true });
      fs.mkdirSync(relayDir, { recursive: true });
      const hsFile = `.handshake_${(agent || "agent").replace(/\s+/g, "_")}`;
      fs.writeFileSync(path.join(latchDir, hsFile), token);
      fs.writeFileSync(path.join(relayDir, hsFile), token);
    } catch {
      fs.mkdirSync(path.join(homeLatchDir(), "handshakes"), { recursive: true });
    }
    if (sse) sse.emit("agents", { workspaceId: project.id, agents: memory.agents });
    res.json({ ok: true, status: "handshaking", token });
  });

  router.post("/api/connect", (req, res) => {
    const { projectId, agent } = req.body || {};
    const project = loadRegistry().projects.find((p) => p.id === projectId) || ContextService.currentProject();
    if (!project) return res.status(404).json({ error: "no_project" });
    const memory = loadMemory(project.id);
    const row = memory.agents.find((a) => a.label === agent || a.id === agent);
    if (row) {
      row.status = "connected";
      row.lastActiveAt = Date.now();
      row.sessionId = id("sess").slice(-5);
    }
    saveMemory(project.id, memory);
    if (watcher) watcher.watch(project.path, project.id);
    if (sse) sse.emit("agents", { workspaceId: project.id, agents: memory.agents });
    res.json({ ok: true, status: "connected", agent: row });
  });

  router.get("/api/memory", (req, res) => {
    const projectId = req.query.projectId || ContextService.currentProject()?.id;
    res.json(loadMemory(projectId));
  });

  router.get("/api/events", (req, res) => {
    const workspaceId = req.query.projectId;
    const session = loadSession();
    const userId = req.headers["x-latch-user"] || req.headers["x-relay-user"] || session.login;
    if (workspaceId && userId && presence) {
      const out = presence.join(workspaceId, userId);
      if (out.escalated) {
        const scope = lockService.lockScope(workspaceId);
        for (const lock of lockTable.list(scope || workspaceId)) lockTable.escalateRegister(lock);
        if (sse) {
          sse.emit("locks", {
            workspaceId,
            locks: lockService.locksFor(scope),
            reads: lockService.readsFor(scope),
          });
        }
      }
      if (sse) sse.emit("presence", { workspaceId, userId, count: out.count, escalated: out.escalated });
    }
    if (sse) sse.subscribe(res, { workspaceId });
    req.on("close", () => {
      if (workspaceId && userId && presence) presence.leave(workspaceId, userId);
    });
  });

  return router;
}

module.exports = {
  createAgentRoutes,
};
