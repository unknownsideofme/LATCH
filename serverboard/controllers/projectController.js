import { ProjectModel } from "../models/Project.js";
import { inngest } from "../services/inngestService.js";
import { RenderService } from "../services/renderService.js";

export const ProjectController = {
  async create(req, res, next) {
    try {
      const { projectName, agentLimit, repo, branch, region, plan } = req.body;
      if (!projectName) return res.status(400).json({ error: "validation_error", message: "projectName required" });

      // 1. Create project row with status: 'queued'
      const project = await ProjectModel.create({
        userId: req.user.id,
        projectName,
        agentLimit,
      });

      const sanitizedName = projectName.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");

      // 2. Dispatch background event to Inngest
      const event = await inngest.send({
        name: "project/create",
        data: {
          projectId: project.id,
          userId: req.user.id,
          payload: {
            name: sanitizedName,
            repo: repo || "https://github.com/unknownsideofme/LATCH",
            branch: branch || "main",
            region: region || "singapore",
            plan: plan || "free",
          },
        },
      });

      res.status(202).json({ message: "Project queued for deployment", project, eventId: event?.ids?.[0] });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { status, limit, offset } = req.query;
      const projects = await ProjectModel.listByUser(req.user.id, {
        status,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      res.json({ projects });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
      if (project.user_id !== req.user.id) return res.status(403).json({ error: "forbidden" });
      res.json({ project });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project) return res.status(404).json({ error: "not_found" });
      if (project.user_id !== req.user.id) return res.status(403).json({ error: "forbidden" });

      if (project.render_id) {
        await ProjectModel.update(project.id, { status: "deleting" });
        await inngest.send({ name: "project/delete", data: { projectId: project.id, renderId: project.render_id } });
        return res.json({ message: "Project teardown queued" });
      }

      await ProjectModel.delete(project.id);
      res.json({ message: "Project deleted" });
    } catch (err) {
      next(err);
    }
  },

  async logs(req, res, next) {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project || project.user_id !== req.user.id) return res.status(404).json({ error: "not_found" });
      if (!project.render_id) return res.json({ logs: [] });

      const logs = await RenderService.getLogs(project.render_id, { limit: req.query.limit });
      res.json({ logs, renderId: project.render_id });
    } catch (err) {
      next(err);
    }
  },

  async deploys(req, res, next) {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project || project.user_id !== req.user.id) return res.status(404).json({ error: "not_found" });
      if (!project.render_id) return res.json({ deploys: [] });

      const deploys = await RenderService.getDeploys(project.render_id);
      res.json({ deploys, renderId: project.render_id });
    } catch (err) {
      next(err);
    }
  },

  async health(req, res) {
    const project = await ProjectModel.findById(req.params.id);
    if (!project?.render_url) return res.json({ live: false });

    try {
      const healthUrl = `${project.render_url.replace(/\/$/, "")}/api/health`;
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
      const ok = response.ok;
      if (ok && project.status !== "active") await ProjectModel.update(project.id, { status: "active" });
      res.json({ live: ok, url: project.render_url });
    } catch (err) {
      res.json({ live: false, error: err.message, url: project.render_url });
    }
  },
};
