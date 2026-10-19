import { ProjectModel } from "../models/Project.js";
import { inngest, runProvisioningWorker, runTeardownWorker } from "../services/inngestService.js";
import { RenderService } from "../services/renderService.js";
import { config } from "../config/env.js";

const ALLOWED_REGIONS = new Set(["singapore", "oregon", "frankfurt", "ohio"]);
const ALLOWED_PLANS = new Set(["free"]);
const ALLOWED_REPO = "https://github.com/unknownsideofme/LATCH";
const BRANCH_REGEX = /^[a-zA-Z0-9_\-\.]{1,100}$/;

export const ProjectController = {
  async create(req, res, next) {
    try {
      const { projectName, branch, region } = req.body;
      if (!projectName || typeof projectName !== "string") {
        return res.status(400).json({ error: "validation_error", message: "projectName is required" });
      }

      // 1. Sanitize and validate project name
      const sanitizedName = projectName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "");

      if (!sanitizedName || sanitizedName.length < 2) {
        return res.status(400).json({
          error: "validation_error",
          message: "projectName must contain at least 2 alphanumeric characters",
        });
      }

      // 2. Validate region and branch against server-side allowlists
      const selectedRegion = ALLOWED_REGIONS.has(region) ? region : "singapore";
      const selectedBranch = branch && BRANCH_REGEX.test(branch) ? branch : "main";
      // Plan is strictly enforced to 'free' to prevent unauthorized billing
      const selectedPlan = "free";

      // 3. Create database row (status: pending)
      const project = await ProjectModel.create({
        userId: req.user.id,
        projectName: sanitizedName,
        agentLimit: 5,
      });

      const payload = {
        name: sanitizedName,
        repo: ALLOWED_REPO,
        branch: selectedBranch,
        region: selectedRegion,
        plan: selectedPlan,
      };

      // 4. Dispatch background deployment event to Inngest
      const event = await inngest.send({
        name: "project/create",
        data: {
          projectId: project.id,
          userId: req.user.id,
          payload,
        },
      });

      // 5. In local development, execute provisioning directly in background
      if (config.isDev) {
        setImmediate(() => runProvisioningWorker(project.id, payload));
      }

      res.status(202).json({
        message: "Project queued for deployment",
        project,
        eventId: event?.ids?.[0],
      });
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
      if (!project || project.user_id !== req.user.id) return res.status(404).json({ error: "not_found" });
      res.json({ project });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project || project.user_id !== req.user.id) return res.status(404).json({ error: "not_found" });

      if (project.render_id) {
        await ProjectModel.update(project.id, { status: "deleting" });
        await inngest.send({ name: "project/delete", data: { projectId: project.id, renderId: project.render_id } });
        if (config.isDev) {
          setImmediate(() => runTeardownWorker(project.id, project.render_id));
        }
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

  async health(req, res, next) {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(404).json({ error: "not_found" });
      }

      if (!project.render_url) {
        return res.json({ live: false });
      }

      const healthUrl = `${project.render_url.replace(/\/$/, "")}/api/health`;
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
      const ok = response.ok;
      if (ok && project.status !== "running") {
        await ProjectModel.update(project.id, { status: "running" });
      }
      res.json({ live: ok, url: project.render_url });
    } catch {
      res.json({ live: false });
    }
  },
};
