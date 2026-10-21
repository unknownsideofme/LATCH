"use strict";

const express = require("express");
const { loadRoom } = require("../lib/room");
const { loadRegistry } = require("../lib/store");
const { requireRoomMember, httpLockSession, roomScopedBody } = require("../middleware/authMiddleware");
const { ContextService } = require("../services/ContextService");

/**
 * Return an Express router for lock status, streams, claims, releases, and read presence.
 * Coordination claims are routed through the room host for guests; locally handled
 * allowed claims may include advisory dependency warnings and recent patch context.
 */
function createLockRoutes({ lockTable, lockService, roomService, sse, workspaceService }) {
  const router = express.Router();

  function readActivity(scoped, file, project) {
    const label = scoped.holder?.label || String(scoped.agentId).split(":")[0];
    return {
      id: `r_${project?.id || "ws"}_${file}_${scoped.agentId}_${Date.now()}`,
      kind: "read",
      agent: label,
      ownerLogin: scoped.holder?.login || ContextService.currentUser().login || "local",
      mine: true,
      file,
      text: `${label} read ${file}`,
      ts: Date.now(),
    };
  }

  router.get("/api/locks", requireRoomMember, (req, res) => {
    try {
      const scope = lockService.lockScope(req.query.projectId || ContextService.currentProject()?.id);
      res.json({
        locks: lockService.locksFor(scope),
        reads: lockService.readsFor(scope),
        raw: scope ? lockTable.status(scope) : { locks: {} },
      });
    } catch (err) {
      console.warn(`[latch] /api/locks: ${err.message || err}`);
      res.json({ locks: [], reads: [], raw: { locks: {} } });
    }
  });

  router.get("/api/locks/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const workspaceId = req.query.projectId;
    const send = () => {
      try {
        const scope = lockService.lockScope(workspaceId);
        const payload = {
          locks: lockService.locksFor(scope),
          reads: lockService.readsFor(scope),
          raw: scope ? lockTable.status(scope) : { locks: {} },
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        console.warn(`[latch] locks/stream: ${err.message || err}`);
      }
    };
    send();
    const listener = () => send();
    lockTable.on("change", listener);
    roomService.roomLocks.on("change", listener);
    req.on("close", () => {
      lockTable.off("change", listener);
      roomService.roomLocks.off("change", listener);
    });
  });

  router.post("/api/coord/claim", requireRoomMember, async (req, res) => {
    const room = loadRoom();
    const body = roomScopedBody(req, req.body || {}, () => ContextService.currentProject());
    if (room?.role === "guest") {
      const payload = {
        ...body,
        workspaceId: room.hostWorkspacePath || body.workspaceId,
        peerWorkspacePath: body.workspaceId,
      };
      try {
        await roomService.roomControl.settled();
        const result = await roomService.roomControl.rpc("claim", payload);
        const answer = { ...(result || { allowed: false }), source: "host" };
        return res.status(answer.allowed ? 200 : 409).json(answer);
      } catch {
        if ((body.mode || "write") !== "read") {
          return res.status(503).json({
            allowed: false,
            degraded: true,
            source: "local_fallback",
            reason: "control_offline",
            detail: "Host unreachable — this claim was never adjudicated by the room.",
          });
        }
      }
    }
    const scoped = lockService.sanitizeLockBody(body, httpLockSession(req));
    if (!scoped) return res.status(400).json({ allowed: false, error: "agent_required" });
    const files = Array.isArray(scoped.files) && scoped.files.length ? scoped.files : [scoped.file];
    const warnings = [];
    const { dependencyRiskReport } = require("../lib/depGraph");
    for (const file of files.filter(Boolean)) {
      const blocked = require("../lib/depGraph").softBlock(lockTable, scoped.workspaceId, scoped.agentId, file);
      const held = blocked?.file ? lockTable.getLock(blocked.file, scoped.workspaceId) : null;
      const { sameOwner } = require("../coordinator/lockTable");
      if (blocked && !(held && sameOwner(held.agentId, scoped.agentId))) {
        warnings.push(blocked);
      }
    }
    const result = await lockService.runLockRpc(
      "claim",
      scoped,
      httpLockSession(req),
      (p) => workspaceService?.ensureWorkspace(p)
    );
    if (warnings.length && result.allowed) {
      result.warning = result.warning || warnings[0].reason || warnings[0].holder || String(warnings[0]);
      result.dependencyPatches = warnings.flatMap((warning) => warning.recentPatches || []);
      result.dependencyWarnings = warnings.map(dependencyRiskReport).filter(Boolean);
    }
    res.status(result.allowed ? 200 : 409).json(result);
  });

  router.post("/api/coord/release", requireRoomMember, async (req, res) => {
    const room = loadRoom();
    const body = roomScopedBody(req, req.body || {}, () => ContextService.currentProject());
    if (room?.role === "guest") {
      try {
        return res.json({ ...(await roomService.roomControl.rpc("release", body)), source: "host" });
      } catch {
        const queued = roomService.roomControl.enqueue("release", body);
        const local = await lockService.runLockRpc(
          "release",
          body,
          httpLockSession(req),
          (p) => workspaceService?.ensureWorkspace(p)
        );
        return res.json({ ...local, source: "local_fallback", degraded: true, queued });
      }
    }
    res.json(await lockService.runLockRpc("release", body, httpLockSession(req), (p) => workspaceService?.ensureWorkspace(p)));
  });

  router.post("/api/coord/heartbeat", requireRoomMember, async (req, res) => {
    const room = loadRoom();
    const body = roomScopedBody(req, req.body || {}, () => ContextService.currentProject());
    if (room?.role === "guest") {
      try {
        return res.json({ ...(await roomService.roomControl.rpc("heartbeat", body, 400)), source: "host" });
      } catch {
        const local = await lockService.runLockRpc(
          "heartbeat",
          body,
          httpLockSession(req),
          (p) => workspaceService?.ensureWorkspace(p)
        );
        return res.json({ ...local, source: "local_fallback", degraded: true });
      }
    }
    res.json(await lockService.runLockRpc("heartbeat", body, httpLockSession(req), (p) => workspaceService?.ensureWorkspace(p)));
  });

  router.post("/api/coord/release-all", requireRoomMember, async (req, res) => {
    const body = roomScopedBody(req, req.body || {}, () => ContextService.currentProject());
    res.json(await lockService.runLockRpc("release-all", body, httpLockSession(req), (p) => workspaceService?.ensureWorkspace(p)));
  });

  router.post("/api/coord/read", requireRoomMember, async (req, res) => {
    const room = loadRoom();
    const body = roomScopedBody(req, req.body || {}, () => ContextService.currentProject());
    let degradedRead = false;
    if (room?.role === "guest") {
      try {
        return res.json(
          await roomService.roomControl.rpc(
            "read",
            { ...body, workspaceId: room.hostWorkspacePath || body.workspaceId },
            300
          )
        );
      } catch {
        degradedRead = true;
      }
    }
    const scoped = lockService.sanitizeLockBody(body, httpLockSession(req));
    if (!scoped) return res.json({ ok: false, error: "agent_required" });
    const files = (Array.isArray(scoped.files) && scoped.files.length ? scoped.files : [scoped.file]).filter(Boolean);
    const project = ContextService.projectForPath(scoped.workspaceId, (p) => workspaceService?.ensureWorkspace(p));
    for (const file of files) {
      lockTable.noteRead({
        agentId: scoped.agentId,
        filePath: file,
        workspaceId: scoped.workspaceId,
        holder: scoped.holder,
      });
      const item = readActivity(scoped, file, project);
      if (sse) sse.emit("activity", { workspaceId: project?.id, item });
      roomService.broadcastRoom({ type: "read", workspaceId: project?.id, item });
    }
    res.json({ ok: true, files, ...(degradedRead ? { source: "local_fallback", degraded: true } : {}) });
  });

  router.get("/api/coord/status", (req, res) => {
    const scope = lockService.lockScope(req.query.projectId);
    res.json(scope ? lockTable.status(scope) : lockTable.status());
  });

  router.post("/api/heartbeat", (req, res) => {
    res.json(lockTable.heartbeat(req.body || {}));
  });

  router.post("/api/claim", (req, res) => {
    const result = lockTable.claim(req.body || {});
    res.status(result.allowed ? 200 : 409).json(result);
  });

  router.post("/api/release", (req, res) => {
    res.json(lockTable.release(req.body || {}));
  });

  router.post("/api/release-all", (req, res) => {
    res.json(lockTable.releaseAll(req.body?.agentId, req.body?.workspaceId, req.body?.leases));
  });

  return router;
}

module.exports = {
  createLockRoutes,
};
