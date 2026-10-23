const express = require("express");
const { sameOwner } = require("../lock/AgentIdentity");
const { softBlock, dependencyRiskReport } = require("../../lib/depGraph");
const { ingest: ingestSupergraph, snapshot: superSnapshot } = require("../../lib/supergraph");

class CoordinatorRouter {
  static createRouter({ lockTable, presence, workspacePath, startedAt }) {
    const app = express();
    app.use(express.json({ limit: "1mb" }));

    app.get("/health", (_req, res) => {
      res.json({
        ok: true,
        port: app.get("port"),
        uptime: (Date.now() - startedAt) / 1000,
        workspacePath: workspacePath || null,
      });
    });

    app.post("/claim", (req, res) => {
      const body = req.body || {};
      const files = Array.isArray(body.files) && body.files.length ? body.files : [body.file];
      const warnings = [];
      for (const file of files.filter(Boolean)) {
        const blocked = softBlock(lockTable, body.workspaceId || workspacePath, body.agentId, file);
        const held = blocked?.file ? lockTable.getLock(blocked.file, body.workspaceId || workspacePath) : null;
        if (blocked && !(held && sameOwner(held.agentId, body.agentId))) {
          warnings.push(blocked);
        }
      }
      const result = lockTable.claim(body);
      if (warnings.length && result.allowed) {
        result.warning = result.warning || warnings[0].reason || warnings[0].holder || String(warnings[0]);
        result.dependencyPatches = warnings.flatMap((warning) => warning.recentPatches || []);
        result.dependencyWarnings = warnings.map(dependencyRiskReport).filter(Boolean);
      }
      res.status(result.allowed ? 200 : 409).json(result);
    });

    app.post("/heartbeat", (req, res) => {
      res.json(lockTable.heartbeat(req.body || {}));
    });

    app.post("/escalate", (req, res) => {
      const locks = req.body?.locks || [];
      const results = locks.map((lock) => lockTable.escalateRegister(lock));
      res.json({ results });
    });

    app.post("/presence", (req, res) => {
      const { workspaceId, userId, action } = req.body || {};
      const out =
        action === "leave"
          ? presence.leave(workspaceId, userId)
          : presence.join(workspaceId, userId);
      if (out.escalated) {
        const snapshot = lockTable.list(workspaceId);
        for (const lock of snapshot) lockTable.escalateRegister(lock);
      }
      res.json(out);
    });

    app.post("/patch", (req, res) => {
      lockTable.emit("patch", req.body || {});
      res.json({ ok: true });
    });

    app.post("/graph", (req, res) => {
      res.json(ingestSupergraph(req.body?.workspaceId, req.body || {}));
    });

    app.get("/graph", (req, res) => {
      res.json(superSnapshot(req.query.workspaceId));
    });

    app.post("/release", (req, res) => {
      res.json(lockTable.release(req.body || {}));
    });

    app.post("/release-all", (req, res) => {
      res.json(lockTable.releaseAll(req.body?.agentId, req.body?.workspaceId, req.body?.leases));
    });

    app.get("/status", (_req, res) => {
      res.json({ ...lockTable.status(), uptime: (Date.now() - startedAt) / 1000 });
    });

    app.get("/stream", (req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      res.write(`data: ${JSON.stringify(lockTable.status())}\n\n`);
      const listener = () => res.write(`data: ${JSON.stringify(lockTable.status())}\n\n`);
      lockTable.on("change", listener);
      req.on("close", () => lockTable.off("change", listener));
    });

    return app;
  }
}

module.exports = { CoordinatorRouter };
