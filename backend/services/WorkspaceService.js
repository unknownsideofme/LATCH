"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { loadRegistry, saveRegistry, saveMemory, loadSession, id, loadMemory } = require("../lib/store");
const { emptyMemory, initials } = require("../lib/seed");
const { installProjectHooks } = require("../lib/installHooks");
const { rebuild } = require("../lib/depGraph");
const { ingest: ingestSupergraph } = require("../lib/supergraph");
const { normalizeWorkspaceRoot, normalizeCompare } = require("../lib/transcripts/util");

class WorkspaceService {
  constructor({ sse, watcher, lockTable, transcriptService }) {
    this.sse = sse;
    this.watcher = watcher;
    this.lockTable = lockTable;
    this.transcriptService = transcriptService;
  }

  ensureWorkspace(workspacePath) {
    const resolved = normalizeWorkspaceRoot(workspacePath) || workspacePath;
    if (!resolved) return null;
    const reg = loadRegistry();
    let project = reg.projects.find((p) => normalizeCompare(p.path) === normalizeCompare(resolved));
    if (!project) {
      project = reg.projects.find(
        (p) => normalizeCompare(normalizeWorkspaceRoot(p.path) || p.path) === normalizeCompare(resolved)
      );
      if (project && project.path !== resolved) {
        project.path = resolved;
        saveRegistry(reg);
      }
    }
    if (!project) {
      project = {
        id: id("proj"),
        name: path.basename(resolved),
        initials: initials(resolved),
        color: "#34d399",
        path: resolved,
        remoteUrl: null,
        apiKey: "rl_" + crypto.randomBytes(12).toString("hex"),
        createdAt: Date.now(),
        lastSyncAt: Date.now(),
      };
      try {
        fs.mkdirSync(path.join(resolved, ".relay"), { recursive: true });
        installProjectHooks(resolved);
      } catch {
        /* ignore */
      }
      reg.projects.push(project);
      saveRegistry(reg);
      saveMemory(project.id, emptyMemory());
      if (this.sse) this.sse.emit("projects", { projects: reg.projects });
    }
    if (this.watcher) this.watcher.watch(project.path, project.id);
    if (this.lockTable) this.lockTable.track(project.path);
    if (this.transcriptService) this.transcriptService.watchTranscripts(project);
    return project;
  }

  publishGraph(project) {
    if (!project?.path) return;
    const g = rebuild(project.path);
    const snap = g ? g.snapshot() : { edges: [] };
    ingestSupergraph(project.id, { userId: loadSession().login, edges: snap.edges || [] });
    if (this.sse) this.sse.emit("graph", { workspaceId: project.id, graph: snap });
  }

  activeAgent(projectId) {
    const memory = loadMemory(projectId);
    const live = (memory.agents || [])
      .filter((a) => a.status === "connected" && Date.now() - (a.lastActiveAt || 0) < 120_000)
      .sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0))[0];
    return live ? { agentActive: true, agentLabel: live.label } : { agentActive: false, agentLabel: null };
  }
}

module.exports = {
  WorkspaceService,
};
