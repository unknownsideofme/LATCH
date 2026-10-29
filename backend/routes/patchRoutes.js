"use strict";

const express = require("express");
const { sameOwner } = require("../coordinator/lockTable");
const { requireRoomMember } = require("../middleware/authMiddleware");
const { ContextService } = require("../services/ContextService");

function createPatchRoutes({ patchService, lockTable, workspaceService }) {
  const router = express.Router();

  router.post("/api/flush-file", async (req, res) => {
    const workspacePath = req.body?.workspacePath;
    const agentId = req.body?.agentId;
    const files = Array.isArray(req.body?.files) && req.body.files.length
      ? req.body.files
      : req.body?.file
        ? [req.body.file]
        : [];
    const project = ContextService.projectForPath(workspacePath, (p) => workspaceService?.ensureWorkspace(p));
    if (!project) return res.status(404).json({ error: "no_local_repo" });
    const flushed = await Promise.all(files.map((file) => patchService.fanOutLocalFile(project, file, agentId)));
    res.json({ ok: true, flushed });
  });

  router.post("/api/flush-owned", async (req, res) => {
    const workspacePath = req.body?.workspacePath;
    const agentId = req.body?.agentId;
    const project = ContextService.projectForPath(workspacePath, (p) => workspaceService?.ensureWorkspace(p));
    if (!project) return res.status(404).json({ error: "no_local_repo" });
    const held = lockTable.list({ id: project.id, path: project.path }).filter((e) => sameOwner(e.agentId, agentId));
    const flushed = await Promise.all(held.map((e) => patchService.fanOutLocalFile(project, e.filePath, agentId)));
    res.json({ ok: true, flushed });
  });

  router.post("/api/patches", requireRoomMember, (req, res) => {
    const patch = req.body?.patch;
    if (!patch) return res.status(400).json({ error: "patch_required" });
    const hint = {
      remoteUrl: req.body.remoteUrl,
      name: req.body.name,
      pathName: req.body.pathName,
    };
    const result = patchService.acceptPeerPatch(patch, hint, { skipIfOrigin: true });
    patchService.broadcastPatch({
      workspaceId: result.projectId || req.body.workspaceId,
      patch,
      incoming: true,
      remoteUrl: hint.remoteUrl,
      name: hint.name,
      pathName: hint.pathName,
      originId: patch.originId,
    });
    res.json({ ok: true, relayed: true, ...result });
  });

  return router;
}

module.exports = {
  createPatchRoutes,
};
