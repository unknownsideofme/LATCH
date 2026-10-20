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
      const projectNameInput = req.body.projectName || req.body.project_name;
      const { branch, region, repo, repo_url } = req.body;
      const agentLimitInput = req.body.agentLimit || req.body.agent_limit || 5;

      if (!projectNameInput || typeof projectNameInput !== "string") {
        return res.status(400).json({ error: "validation_error", message: "projectName (or project_name) is required" });
      }

      // 1. Sanitize and validate project name
      const sanitizedName = projectNameInput
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
      const selectedRepo = repo || repo_url || ALLOWED_REPO;
      // Plan is strictly enforced to 'free' to prevent unauthorized billing
      const selectedPlan = "free";

      // 3. Create database row (status: pending)
      const project = await ProjectModel.create({
        userId: req.user.id,
        projectName: sanitizedName,
        agentLimit: Number(agentLimitInput) || 5,
      });

      const payload = {
        name: sanitizedName,
        repo: selectedRepo,
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

      const connectionStatus = "connecting";
      res.status(202).json({
        message: "Project queued for deployment",
        project: {
          ...project,
          connection_status: connectionStatus,
          repo_details: {
            repo_url: selectedRepo,
            branch: selectedBranch,
            runtime: "docker",
          },
        },
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

      // Auto-reconcile any 'deploying' project whose Render container is already live
      await Promise.all(
        projects.map(async p => {
          if (p.status === "deploying" && p.render_url) {
            try {
              const check = await fetch(`${p.render_url.replace(/\/$/, "")}/api/health`, {
                signal: AbortSignal.timeout(1500),
              });
              if (check.ok || check.status === 200) {
                p.status = "running";
                await ProjectModel.update(p.id, { status: "running" });
              }
            } catch {}
          }
        })
      );

      const enrichedProjects = projects.map(p => ({
        ...p,
        connection_status:
          p.status === "running" ? "connected" :
          p.status === "deploying" ? "connecting" :
          p.status === "failed" ? "disconnected" :
          p.status,
      }));

      res.json({ projects: enrichedProjects });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const id = req.params.id?.replace(/^:/, "");
      const project = await ProjectModel.findById(id);
      if (!project || project.user_id !== req.user.id) return res.status(404).json({ error: "not_found" });

      if (project.status === "deploying" && project.render_url) {
        try {
          const check = await fetch(`${project.render_url.replace(/\/$/, "")}/api/health`, {
            signal: AbortSignal.timeout(1500),
          });
          if (check.ok || check.status === 200) {
            project.status = "running";
            await ProjectModel.update(project.id, { status: "running" });
          }
        } catch {}
      }

      const connectionStatus =
        project.status === "running" ? "connected" :
        project.status === "deploying" ? "connecting" :
        project.status === "failed" ? "disconnected" :
        project.status;

      res.json({
        project: {
          ...project,
          connection_status: connectionStatus,
          repo_details: {
            repo_url: ALLOWED_REPO,
            branch: "main",
            runtime: "docker",
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async patch(req, res, next) {
    try {
      const id = req.params.id?.replace(/^:/, "");
      const project = await ProjectModel.findById(id);
      if (!project || project.user_id !== req.user.id) return res.status(404).json({ error: "not_found" });

      const { branch, agent_limit, agentLimit, project_name, projectName, env_vars, environment_variables } = req.body;

      const updates = {};
      const newLimit = agent_limit ?? agentLimit;
      if (newLimit !== undefined) updates.agent_limit = Number(newLimit);
      const newName = project_name ?? projectName;
      if (newName) updates.project_name = String(newName).trim();

      let updatedProject = project;
      if (Object.keys(updates).length > 0) {
        updatedProject = await ProjectModel.update(project.id, updates);
      }

      // If branch changed and Render service exists, update branch on Render
      if (branch && project.render_id && BRANCH_REGEX.test(branch)) {
        try {
          await RenderService.updateService(project.render_id, { branch });
        } catch (renderErr) {
          console.warn("[project] Warning updating branch on Render:", renderErr.message);
        }
      }

      const connectionStatus =
        updatedProject.status === "running" ? "connected" :
        updatedProject.status === "deploying" ? "connecting" :
        updatedProject.status === "failed" ? "disconnected" :
        updatedProject.status;

      res.json({
        message: "Project settings updated successfully",
        project: {
          ...updatedProject,
          connection_status: connectionStatus,
          settings: {
            branch: branch || "main",
            agent_limit: updatedProject.agent_limit,
            env_vars: env_vars || environment_variables || {},
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const id = req.params.id?.replace(/^:/, "");
      const project = await ProjectModel.findById(id);
      if (!project || project.user_id !== req.user.id) return res.status(404).json({ error: "not_found" });

      if (project.render_id) {
        await ProjectModel.update(project.id, { status: "deleting" });
        await inngest.send({ name: "project/delete", data: { projectId: project.id, renderId: project.render_id } });
        if (config.isDev) {
          await runTeardownWorker(project.id, project.render_id);
          return res.json({ message: "Render service and project deleted successfully" });
        }
        return res.json({ message: "Project teardown queued" });
      }

      await ProjectModel.delete(project.id);
      res.json({ message: "Project deleted successfully" });
    } catch (err) {
      next(err);
    }
  },

  async logs(req, res, next) {
    try {
      const id = req.params.id?.replace(/^:/, "");
      const project = await ProjectModel.findById(id);
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
      const id = req.params.id?.replace(/^:/, "");
      const project = await ProjectModel.findById(id);
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
      const id = req.params.id?.replace(/^:/, "");
      const project = await ProjectModel.findById(id);
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
