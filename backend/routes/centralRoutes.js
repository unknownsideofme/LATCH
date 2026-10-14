"use strict";

const express = require("express");
const { createProject, loadProjects } = require("../lib/centralAuth");
const { appendEvent, listEvents, jsonContext } = require("../lib/centralStore");
const { requireCentral } = require("../middleware/authMiddleware");

function createCentralRoutes({ sse }) {
  const router = express.Router();

  router.post("/api/central/projects", requireCentral, (req, res) => {
    if (!req.central.admin) return res.status(403).json({ error: "admin_only" });
    res.status(201).json(createProject(req.body?.name));
  });

  router.get("/api/central/projects", requireCentral, (req, res) => {
    if (!req.central.admin) return res.status(403).json({ error: "admin_only" });
    res.json({ projects: loadProjects() });
  });

  router.get("/api/central/projects/:id", requireCentral, async (req, res) => {
    if (!req.central.admin && req.central.project?.id !== req.params.id) {
      return res.status(403).json({ error: "project_mismatch" });
    }
    const project = loadProjects().find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    res.json({ project });
  });

  router.post("/api/central/projects/:id/events", requireCentral, async (req, res) => {
    if (!req.central.admin && req.central.project?.id !== req.params.id) {
      return res.status(403).json({ error: "project_mismatch" });
    }
    const stored = await appendEvent(req.params.id, req.body || {});
    if (sse) sse.emit("central", { workspaceId: req.params.id, event: stored });
    res.json(stored);
  });

  router.get("/api/central/projects/:id/events", requireCentral, async (req, res) => {
    if (!req.central.admin && req.central.project?.id !== req.params.id) {
      return res.status(403).json({ error: "project_mismatch" });
    }
    const events = await listEvents(req.params.id, {
      since: req.query.since,
      limit: req.query.limit,
      kind: req.query.kind,
    });
    res.json({ events });
  });

  router.get("/api/central/projects/:id/context", requireCentral, async (req, res) => {
    if (!req.central.admin && req.central.project?.id !== req.params.id) {
      return res.status(403).json({ error: "project_mismatch" });
    }
    const events = await listEvents(req.params.id, { limit: 1000 });
    res.json(jsonContext(events));
  });

  router.get("/api/central/projects/:id/changes", requireCentral, async (req, res) => {
    if (!req.central.admin && req.central.project?.id !== req.params.id) {
      return res.status(403).json({ error: "project_mismatch" });
    }
    const events = await listEvents(req.params.id, { kind: "change", limit: 200 });
    res.json({ changes: events });
  });

  router.get("/api/central/projects/:id/decisions", requireCentral, async (req, res) => {
    if (!req.central.admin && req.central.project?.id !== req.params.id) {
      return res.status(403).json({ error: "project_mismatch" });
    }
    res.json({ decisions: jsonContext(await listEvents(req.params.id, { limit: 1000 })).decisions });
  });

  router.get("/api/central/projects/:id/tasks", requireCentral, async (req, res) => {
    if (!req.central.admin && req.central.project?.id !== req.params.id) {
      return res.status(403).json({ error: "project_mismatch" });
    }
    res.json({ tasks: jsonContext(await listEvents(req.params.id, { limit: 1000 })).tasks });
  });

  return router;
}

module.exports = {
  createCentralRoutes,
};
