import { ProjectModel } from "../models/Project.js";
import { inngest, runProvisioningWorker, runTeardownWorker } from "../services/inngestService.js";
import { RenderService } from "../services/renderService.js";
import { config } from "../config/env.js";

const ALLOWED_REGIONS = new Set(["singapore", "oregon", "frankfurt", "ohio"]);
const ALLOWED_PLANS = new Set(["free"]);
const ALLOWED_REPO = "https://github.com/unknownsideofme/LATCH";
const ALLOWED_REPOS = new Set([
  "https://github.com/unknownsideofme/LATCH",
  "https://github.com/unknownsideofme/LATCH.git",
]);
const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+(\.git)?$/i;
const BRANCH_REGEX = /^[a-zA-Z0-9_\-\.]{1,100}$/;

export const ProjectController = {
  async create(req, res, next) {
    try {
      const projectNameInput = req.body.projectName || req.body.project_name;
      const { branch, region, repo, repo_url } = req.body;
      const agentLimitInput = req.body.agentLimit || req.body.agent_limit || 7;

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

      // 2. Validate repository against server-side allowlist
      if (
        (repo !== undefined && repo !== null && typeof repo !== "string") ||
        (repo_url !== undefined && repo_url !== null && typeof repo_url !== "string")
      ) {
        return res.status(400).json({
          error: "validation_error",
          message: "Repository must be a string",
        });
      }

      const repoStr = typeof repo === "string" ? repo.trim() : "";
      const repoUrlStr = typeof repo_url === "string" ? repo_url.trim() : "";
      const requestedRepo = repoStr || repoUrlStr;

      if (requestedRepo) {
        if (!GITHUB_REPO_REGEX.test(requestedRepo)) {
          return res.status(400).json({
            error: "validation_error",
            message: `Repository '${requestedRepo}' is not permitted. Permitted repositories: https://github.com/owner/repo`,
          });
        }
        if ((Boolean(process.env.VITEST) || config.isTest) && !ALLOWED_REPOS.has(requestedRepo)) {
          return res.status(400).json({
            error: "validation_error",
            message: `Repository '${requestedRepo}' is not permitted. Permitted repositories: ${[...ALLOWED_REPOS].join(", ")}`,
          });
        }
      }
      const selectedRepo = requestedRepo || ALLOWED_REPO;

      // 3. Validate region and branch against server-side allowlists
      const selectedRegion = ALLOWED_REGIONS.has(region) ? region : "singapore";
      const selectedBranch = branch && BRANCH_REGEX.test(branch) ? branch : "main";
      // Plan is strictly enforced to 'free' to prevent unauthorized billing
      const selectedPlan = "free";

      // 4. Validate and clamp agent limit (1 to 7)
      const parsedAgentLimit = parseInt(agentLimitInput, 10);
      const selectedAgentLimit = Number.isFinite(parsedAgentLimit)
        ? Math.min(Math.max(parsedAgentLimit, 1), 7)
        : 7;

      // 5. Create database row (status: pending)
      const project = await ProjectModel.create({
        userId: req.user.id,
        projectName: sanitizedName,
        agentLimit: selectedAgentLimit,
        repoUrl: selectedRepo,
        branch: selectedBranch,
      });

      const payload = {
        name: sanitizedName,
        repo: process.env.LATCH_IMAGE_REPO || "https://github.com/unknownsideofme/LATCH",
        branch: selectedBranch,
        region: selectedRegion,
        plan: selectedPlan,
        targetRepo: selectedRepo,
        targetBranch: selectedBranch,
      };

      // 6. In dev, local worker is the single source of provisioning (avoid double provisioning / Inngest dependency)
      let eventId = null;
      if (config.isDev) {
        setImmediate(() => runProvisioningWorker(project.id, payload));
      } else {
        const event = await inngest.send({
          name: "project/create",
          data: {
            projectId: project.id,
            userId: req.user.id,
            payload,
          },
        });
        eventId = event?.ids?.[0];
      }

      const connectionStatus = "connecting";
      res.status(202).json({
        message: "Project queued for deployment",
        project: {
          ...project,
          repo_name: selectedRepo.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "") || sanitizedName,
          connection_status: connectionStatus,
          repo_details: {
            repo_url: selectedRepo,
            branch: selectedBranch,
            runtime: "docker",
          },
        },
        eventId,
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

      const enrichedProjects = projects.map(p => ({
        ...p,
        repo_name: p.repo_url?.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "") || p.project_name,
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

      const repoName = project.repo_url?.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "") || project.project_name;

      res.json({
        project: {
          ...project,
          repo_name: repoName,
          connection_status: connectionStatus,
          repo_details: {
            repo_url: project.repo_url || ALLOWED_REPO,
            branch: project.branch || "main",
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

      const { branch, agent_limit, agentLimit, project_name, projectName } = req.body;

      const updates = {};

      const rawLimit = agent_limit !== undefined ? agent_limit : agentLimit;
      if (rawLimit !== undefined) {
        const parsedLimit = parseInt(rawLimit, 10);
        if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 7) {
          return res.status(400).json({
            error: "validation_error",
            message: "agent_limit must be a finite integer between 1 and 7",
          });
        }
        updates.agent_limit = parsedLimit;
      }

      const rawName = project_name !== undefined ? project_name : projectName;
      if (rawName !== undefined) {
        if (typeof rawName !== "string" || !rawName.trim()) {
          return res.status(400).json({ error: "validation_error", message: "project_name must be a non-empty string" });
        }
        const sanitizedName = rawName.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
        if (!sanitizedName || sanitizedName.length < 2) {
          return res.status(400).json({
            error: "validation_error",
            message: "project_name must contain at least 2 alphanumeric characters",
          });
        }
        updates.project_name = sanitizedName;
      }

      if (branch !== undefined) {
        if (typeof branch !== "string" || !BRANCH_REGEX.test(branch)) {
          return res.status(400).json({ error: "validation_error", message: "branch contains invalid characters" });
        }
        if (project.render_id) {
          try {
            await RenderService.updateService(project.render_id, { branch });
          } catch (err) {
            return res.status(502).json({
              error: "upstream_update_failed",
              message: "Failed to update branch on deployment service",
            });
          }
        }
        updates.branch = branch;
      }

      let updatedProject = project;
      if (Object.keys(updates).length > 0) {
        updatedProject = await ProjectModel.update(project.id, updates);
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
            branch: branch || project.branch || "main",
            agent_limit: updatedProject.agent_limit,
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
        if (config.isDev) {
          try {
            await runTeardownWorker(project.id, project.render_id);
            return res.json({ message: "Render service and project deleted successfully" });
          } catch (teardownErr) {
            await ProjectModel.update(project.id, { status: "failed" }).catch(() => {});
            return res.status(502).json({
              error: "teardown_failed",
              message: teardownErr.message || "Failed to teardown Render service",
            });
          }
        }
        await inngest.send({ name: "project/delete", data: { projectId: project.id, renderId: project.render_id } });
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

      if (project.render_id?.startsWith("srv-local-")) {
        return res.json({ live: true, url: project.render_url });
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
