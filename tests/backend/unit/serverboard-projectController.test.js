import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../serverboard/models/Project.js", () => ({
  ProjectModel: {
    findById: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    countByUser: vi.fn(),
    listByUser: vi.fn(),
  },
}));
vi.mock("../../../serverboard/services/renderService.js", () => ({
  RenderService: {
    updateService: vi.fn(),
    getLogs: vi.fn(),
    getDeploys: vi.fn(),
  },
}));
vi.mock("../../../serverboard/services/inngestService.js", () => ({
  inngest: { send: vi.fn() },
  runProvisioningWorker: vi.fn(),
  runTeardownWorker: vi.fn(),
}));
vi.mock("../../../serverboard/config/env.js", () => ({
  config: { isDev: false, isProd: false, port: 4000, corsOrigins: [], supabase: {} },
}));
vi.mock("../../../serverboard/config/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })),
      })),
    })),
  },
}));

import { ProjectController } from "../../../serverboard/controllers/projectController.js";
import { ProjectModel } from "../../../serverboard/models/Project.js";
import { RenderService } from "../../../serverboard/services/renderService.js";
import { inngest, runProvisioningWorker, runTeardownWorker } from "../../../serverboard/services/inngestService.js";
import { config } from "../../../serverboard/config/env.js";

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
    return res;
  };
  return res;
}

const baseProject = {
  id: "proj-1",
  user_id: "user-1",
  render_id: "render-1",
  branch: "main",
  status: "running",
  render_url: "https://my-app.onrender.com",
};

beforeEach(() => {
  vi.resetAllMocks();
  config.isDev = false;
  config.isProd = false;

  inngest.send.mockResolvedValue({ ids: ["evt-1"] });
  RenderService.updateService.mockResolvedValue({});
  ProjectModel.update.mockImplementation(async (id, updates) => ({ ...baseProject, id, ...updates }));
  ProjectModel.delete.mockResolvedValue(true);
  ProjectModel.listByUser.mockResolvedValue([]);
});

// ─── patch() ────────────────────────────────────────────────────────────────

describe("patch()", () => {
  test("branch-only PATCH persists the new branch to the database", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    RenderService.updateService.mockResolvedValue({});
    ProjectModel.update.mockResolvedValue({ ...baseProject, branch: "feature-x" });

    const req = { params: { id: ":proj-1" }, body: { branch: "feature-x" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", expect.objectContaining({ branch: "feature-x" }));
    expect(res._status).toBe(200);
    expect(res._body.project.settings.branch).toBe("feature-x");
  });

  test("valid branch names (letters, numbers, dashes, dots, underscores up to 100 chars)", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    RenderService.updateService.mockResolvedValue({});
    ProjectModel.update.mockResolvedValue({ ...baseProject, branch: "v1.2.3-release_candidate" });

    const req = { params: { id: "proj-1" }, body: { branch: "v1.2.3-release_candidate" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(200);
    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", expect.objectContaining({ branch: "v1.2.3-release_candidate" }));
  });

  test.each([
    ["bad branch!"],
    ["feature/nested"],
    ["branch$name"],
    [""],
    ["a".repeat(101)],
  ])("invalid branch '%s' returns 400 validation error", async (invalidBranch) => {
    ProjectModel.findById.mockResolvedValue(baseProject);

    const req = { params: { id: "proj-1" }, body: { branch: invalidBranch }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(res._body.message).toMatch(/branch contains invalid characters/i);
    expect(ProjectModel.update).not.toHaveBeenCalled();
  });

  test("failed Render update returns 502 instead of success and does not update database", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    RenderService.updateService.mockRejectedValue(new Error("Render down"));

    const req = { params: { id: "proj-1" }, body: { branch: "hotfix" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(502);
    expect(res._body.error).toBe("upstream_update_failed");
    expect(ProjectModel.update).not.toHaveBeenCalled();
  });

  test("skips Render call when project has no render_id", async () => {
    const noRender = { ...baseProject, render_id: null };
    ProjectModel.findById.mockResolvedValue(noRender);
    ProjectModel.update.mockResolvedValue({ ...noRender, branch: "staging" });

    const req = { params: { id: "proj-1" }, body: { branch: "staging" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(RenderService.updateService).not.toHaveBeenCalled();
    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", expect.objectContaining({ branch: "staging" }));
  });

  test.each([0, -1, 8, 99, "invalid", NaN])("invalid agent_limit '%s' returns 400", async (badLimit) => {
    ProjectModel.findById.mockResolvedValue(baseProject);

    const req = { params: { id: "proj-1" }, body: { agent_limit: badLimit }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(ProjectModel.update).not.toHaveBeenCalled();
  });

  test.each([1, 3, 5])("valid agent_limit %d updates project", async (limit) => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    ProjectModel.update.mockResolvedValue({ ...baseProject, agent_limit: limit });

    const req = { params: { id: "proj-1" }, body: { agent_limit: limit }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(200);
    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", { agent_limit: limit });
  });

  test.each(["", " ", "a", "---", 12345])("invalid project_name '%s' returns 400", async (badName) => {
    ProjectModel.findById.mockResolvedValue(baseProject);

    const req = { params: { id: "proj-1" }, body: { project_name: badName }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(ProjectModel.update).not.toHaveBeenCalled();
  });

  test("valid project_name updates project with sanitized name", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    ProjectModel.update.mockResolvedValue({ ...baseProject, project_name: "new-name" });

    const req = { params: { id: "proj-1" }, body: { project_name: "  New Name! " }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(200);
    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", { project_name: "new-name" });
  });

  test("returns 404 when project not found", async () => {
    ProjectModel.findById.mockResolvedValue(null);

    const req = { params: { id: "missing" }, body: { branch: "main" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(404);
  });

  test("returns 404 when project is owned by another user", async () => {
    ProjectModel.findById.mockResolvedValue({ ...baseProject, user_id: "other-user" });

    const req = { params: { id: "proj-1" }, body: { branch: "main" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(404);
  });

  test("forwards database update error to next(err)", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    RenderService.updateService.mockResolvedValue({});
    const dbErr = new Error("DB lock timeout");
    ProjectModel.update.mockRejectedValue(dbErr);

    const req = { params: { id: "proj-1" }, body: { branch: "main" }, user: { id: "user-1" } };
    const res = makeRes();
    const next = vi.fn();
    await ProjectController.patch(req, res, next);

    expect(next).toHaveBeenCalledWith(dbErr);
  });
});

// ─── create() ───────────────────────────────────────────────────────────────

describe("create() — repository validation", () => {
  const validBody = { projectName: "my-app" };

  test.each([
    [{ url: "x" }, "object repo"],
    [["https://github.com/unknownsideofme/LATCH"], "array repo"],
    [12345, "numeric repo"],
    [true, "boolean repo"],
  ])("rejects non-string repo value (%s) with 400", async (badRepo) => {
    const req = { body: { ...validBody, repo: badRepo }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(res._body.message).toMatch(/string/i);
  });

  test.each([
    [{ url: "x" }, "object repo_url"],
    [["https://github.com/unknownsideofme/LATCH"], "array repo_url"],
    [9876, "numeric repo_url"],
  ])("rejects non-string repo_url value (%s) with 400", async (badRepoUrl) => {
    const req = { body: { ...validBody, repo_url: badRepoUrl }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(res._body.message).toMatch(/string/i);
  });

  test("omitted repository uses documented default repository", async () => {
    ProjectModel.create.mockResolvedValue({ id: "proj-def", project_name: "my-app", status: "pending", agent_limit: 5 });

    const req = { body: { projectName: "my-app" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(202);
    expect(res._body.project.repo_details.repo_url).toBe("https://github.com/unknownsideofme/LATCH");
  });

  test("empty repository string uses documented default repository", async () => {
    ProjectModel.create.mockResolvedValue({ id: "proj-empty", project_name: "my-app", status: "pending", agent_limit: 5 });

    const req = { body: { projectName: "my-app", repo: "" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(202);
    expect(res._body.project.repo_details.repo_url).toBe("https://github.com/unknownsideofme/LATCH");
  });

  test("fallback to repo_url when repo is empty string", async () => {
    ProjectModel.create.mockResolvedValue({ id: "proj-fb", project_name: "my-app", status: "pending", agent_limit: 5 });

    const req = {
      body: { projectName: "my-app", repo: "", repo_url: "https://github.com/unknownsideofme/LATCH.git" },
      user: { id: "user-1" },
    };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(202);
    expect(res._body.project.repo_details.repo_url).toBe("https://github.com/unknownsideofme/LATCH.git");
  });

  test("permitted repo URL is accepted", async () => {
    ProjectModel.create.mockResolvedValue({ id: "proj-2", project_name: "my-app", status: "pending", agent_limit: 5 });

    const req = {
      body: { ...validBody, repo: "https://github.com/unknownsideofme/LATCH" },
      user: { id: "user-1" },
    };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(202);
  });

  test("permitted .git repo URL is accepted", async () => {
    ProjectModel.create.mockResolvedValue({ id: "proj-3", project_name: "my-app", status: "pending", agent_limit: 5 });

    const req = {
      body: { ...validBody, repo: "https://github.com/unknownsideofme/LATCH.git" },
      user: { id: "user-1" },
    };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(202);
  });

  test.each([
    ["https://github.com/other/repo"],
    ["not-a-valid-url"],
    ["ftp://github.com/unknownsideofme/LATCH"],
  ])("disallowed or malformed repo URL '%s' returns 400", async (badUrl) => {
    const req = { body: { ...validBody, repo: badUrl }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(res._body.message).toMatch(/not permitted/i);
  });
});

describe("create() — project name and input validation", () => {
  test.each([
    [undefined, "missing name"],
    [null, "null name"],
    [12345, "numeric name"],
    ["", "empty name"],
    ["   ", "whitespace name"],
    ["a", "single char name"],
    ["---", "hyphens only name"],
    ["!@#$%", "symbols only name"],
  ])("rejects invalid project name '%s' with 400", async (name) => {
    const req = { body: { projectName: name }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(ProjectModel.create).not.toHaveBeenCalled();
  });

  test("accepts project_name alias and normalizes uppercase/spaces", async () => {
    ProjectModel.create.mockResolvedValue({ id: "proj-norm", project_name: "my-great-app", status: "pending", agent_limit: 5 });

    const req = { body: { project_name: "  My Great App!  " }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(202);
    expect(ProjectModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: "my-great-app" })
    );
  });

  describe("region support and fallback", () => {
    test.each(["singapore", "oregon", "frankfurt", "ohio"])("accepts supported region '%s'", async (reg) => {
      ProjectModel.create.mockResolvedValue({ id: "proj-reg", project_name: "my-app", status: "pending", agent_limit: 5 });

      const req = { body: { projectName: "my-app", region: reg }, user: { id: "user-1" } };
      const res = makeRes();
      await ProjectController.create(req, res, vi.fn());

      expect(res._status).toBe(202);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: expect.objectContaining({ region: reg }),
          }),
        })
      );
    });

    test.each(["us-east-1", "mars-central", "", null, undefined])("falls back to 'singapore' for region '%s'", async (invalidReg) => {
      ProjectModel.create.mockResolvedValue({ id: "proj-reg-fb", project_name: "my-app", status: "pending", agent_limit: 5 });

      const req = { body: { projectName: "my-app", region: invalidReg }, user: { id: "user-1" } };
      const res = makeRes();
      await ProjectController.create(req, res, vi.fn());

      expect(res._status).toBe(202);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: expect.objectContaining({ region: "singapore" }),
          }),
        })
      );
    });
  });

  describe("branch defaults in create()", () => {
    test("valid branch is preserved in create payload", async () => {
      ProjectModel.create.mockResolvedValue({ id: "proj-b1", project_name: "my-app", status: "pending", agent_limit: 5 });

      const req = { body: { projectName: "my-app", branch: "staging-v2" }, user: { id: "user-1" } };
      const res = makeRes();
      await ProjectController.create(req, res, vi.fn());

      expect(res._status).toBe(202);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: expect.objectContaining({ branch: "staging-v2" }),
          }),
        })
      );
    });

    test.each(["invalid branch!", "feature/foo", "", null, undefined])(
      "invalid or missing branch '%s' falls back to 'main'",
      async (invalidBranch) => {
        ProjectModel.create.mockResolvedValue({ id: "proj-b2", project_name: "my-app", status: "pending", agent_limit: 5 });

        const req = { body: { projectName: "my-app", branch: invalidBranch }, user: { id: "user-1" } };
        const res = makeRes();
        await ProjectController.create(req, res, vi.fn());

        expect(res._status).toBe(202);
        expect(inngest.send).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              payload: expect.objectContaining({ branch: "main" }),
            }),
          }),
        );
      }
    );
  });

  describe("agent_limit clamping and fallback in create()", () => {
    test.each([
      [1, 1],
      [5, 5],
      [3, 3],
      [-5, 1],
      [0, 7], // 0 is falsy, falls back to 7
      [10, 7], // clamped to 7
      ["4", 4],
      ["invalid", 7],
      [undefined, 7],
    ])("agentLimitInput %s resolves to agentLimit %d", async (input, expected) => {
      ProjectModel.create.mockResolvedValue({ id: "proj-lim", project_name: "my-app", status: "pending", agent_limit: expected });

      const req = { body: { projectName: "my-app", agent_limit: input }, user: { id: "user-1" } };
      const res = makeRes();
      await ProjectController.create(req, res, vi.fn());

      expect(res._status).toBe(202);
      expect(ProjectModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ agentLimit: expected })
      );
    });
  });

  describe("environment-dependent provisioning execution in create()", () => {
    test("in dev mode (config.isDev=true), schedules local runProvisioningWorker and returns null eventId", async () => {
      config.isDev = true;
      ProjectModel.create.mockResolvedValue({ id: "proj-dev", project_name: "my-app", status: "pending", agent_limit: 5 });

      const req = { body: { projectName: "my-app" }, user: { id: "user-1" } };
      const res = makeRes();
      await ProjectController.create(req, res, vi.fn());

      expect(res._status).toBe(202);
      expect(res._body.eventId).toBeNull();
      expect(inngest.send).not.toHaveBeenCalled();
      // Wait a tick for setImmediate
      await new Promise((r) => setImmediate(r));
      expect(runProvisioningWorker).toHaveBeenCalledWith("proj-dev", expect.any(Object));
    });

    test("forwards database creation error to next(err)", async () => {
      const dbErr = new Error("Project limit reached");
      ProjectModel.create.mockRejectedValue(dbErr);

      const req = { body: { projectName: "my-app" }, user: { id: "user-1" } };
      const res = makeRes();
      const next = vi.fn();
      await ProjectController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(dbErr);
    });
  });
});

// ─── list() ─────────────────────────────────────────────────────────────────

describe("list()", () => {
  test("forwards status, limit, and offset query parameters", async () => {
    ProjectModel.listByUser.mockResolvedValue([
      { id: "p1", status: "running" },
      { id: "p2", status: "deploying" },
      { id: "p3", status: "failed" },
      { id: "p4", status: "pending" },
    ]);

    const req = { query: { status: "running", limit: "10", offset: "20" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.list(req, res, vi.fn());

    expect(ProjectModel.listByUser).toHaveBeenCalledWith("user-1", {
      status: "running",
      limit: 10,
      offset: 20,
    });
    expect(res._body.projects[0].connection_status).toBe("connected");
    expect(res._body.projects[1].connection_status).toBe("connecting");
    expect(res._body.projects[2].connection_status).toBe("disconnected");
    expect(res._body.projects[3].connection_status).toBe("pending");
  });

  test("forwards list database errors to next(err)", async () => {
    const err = new Error("Query timeout");
    ProjectModel.listByUser.mockRejectedValue(err);

    const req = { query: {}, user: { id: "user-1" } };
    const res = makeRes();
    const next = vi.fn();
    await ProjectController.list(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── get() ──────────────────────────────────────────────────────────────────

describe("get()", () => {
  test("returns 404 when project not found", async () => {
    ProjectModel.findById.mockResolvedValue(null);

    const req = { params: { id: "missing" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.get(req, res, vi.fn());

    expect(res._status).toBe(404);
  });

  test("strips leading colon from params.id", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);

    const req = { params: { id: ":proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.get(req, res, vi.fn());

    expect(ProjectModel.findById).toHaveBeenCalledWith("proj-1");
    expect(res._status).toBe(200);
  });

  test("checks health and updates deploying project to running if health check succeeds", async () => {
    const deployingProject = {
      ...baseProject,
      status: "deploying",
      render_url: "https://dep-app.onrender.com",
    };
    ProjectModel.findById.mockResolvedValue(deployingProject);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const req = { params: { id: "proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.get(req, res, vi.fn());

    expect(fetchMock).toHaveBeenCalledWith("https://dep-app.onrender.com/api/health", expect.any(Object));
    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", { status: "running" });
    expect(res._body.project.status).toBe("running");
    expect(res._body.project.connection_status).toBe("connected");

    vi.unstubAllGlobals();
  });
});

// ─── delete() ───────────────────────────────────────────────────────────────

describe("delete()", () => {
  test("returns 404 when project does not exist", async () => {
    ProjectModel.findById.mockResolvedValue(null);

    const req = { params: { id: "missing" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.delete(req, res, vi.fn());

    expect(res._status).toBe(404);
  });

  test("deletes from DB directly when project has no render_id", async () => {
    ProjectModel.findById.mockResolvedValue({ ...baseProject, render_id: null });
    ProjectModel.delete.mockResolvedValue(true);

    const req = { params: { id: ":proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.delete(req, res, vi.fn());

    expect(ProjectModel.delete).toHaveBeenCalledWith("proj-1");
    expect(res._status).toBe(200);
    expect(res._body.message).toMatch(/deleted successfully/i);
  });

  test("in production, queues teardown via Inngest when project has render_id", async () => {
    config.isDev = false;
    ProjectModel.findById.mockResolvedValue(baseProject);

    const req = { params: { id: "proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.delete(req, res, vi.fn());

    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", { status: "deleting" });
    expect(inngest.send).toHaveBeenCalledWith({
      name: "project/delete",
      data: { projectId: "proj-1", renderId: "render-1" },
    });
    expect(res._body.message).toMatch(/teardown queued/i);
  });

  test("in dev mode, runs runTeardownWorker synchronously", async () => {
    config.isDev = true;
    ProjectModel.findById.mockResolvedValue(baseProject);
    runTeardownWorker.mockResolvedValue({ success: true });

    const req = { params: { id: "proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.delete(req, res, vi.fn());

    expect(runTeardownWorker).toHaveBeenCalledWith("proj-1", "render-1");
    expect(res._status).toBe(200);
  });

  test("in dev mode, returns 502 when runTeardownWorker fails", async () => {
    config.isDev = true;
    ProjectModel.findById.mockResolvedValue(baseProject);
    runTeardownWorker.mockRejectedValue(new Error("Render API offline"));

    const req = { params: { id: "proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.delete(req, res, vi.fn());

    expect(res._status).toBe(502);
    expect(res._body.error).toBe("teardown_failed");
    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", { status: "failed" });
  });
});

// ─── logs() & deploys() ─────────────────────────────────────────────────────

describe("logs() and deploys()", () => {
  test("logs() returns empty array when project has no render_id", async () => {
    ProjectModel.findById.mockResolvedValue({ ...baseProject, render_id: null });

    const req = { params: { id: "proj-1" }, query: {}, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.logs(req, res, vi.fn());

    expect(res._body).toEqual({ logs: [] });
    expect(RenderService.getLogs).not.toHaveBeenCalled();
  });

  test("logs() calls RenderService.getLogs with limit query param", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    RenderService.getLogs.mockResolvedValue([{ message: "Starting server" }]);

    const req = { params: { id: ":proj-1" }, query: { limit: "50" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.logs(req, res, vi.fn());

    expect(RenderService.getLogs).toHaveBeenCalledWith("render-1", { limit: "50" });
    expect(res._body).toEqual({ logs: [{ message: "Starting server" }], renderId: "render-1" });
  });

  test("deploys() calls RenderService.getDeploys", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    RenderService.getDeploys.mockResolvedValue([{ id: "dep-1", status: "live" }]);

    const req = { params: { id: ":proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.deploys(req, res, vi.fn());

    expect(RenderService.getDeploys).toHaveBeenCalledWith("render-1");
    expect(res._body).toEqual({ deploys: [{ id: "dep-1", status: "live" }], renderId: "render-1" });
  });
});

// ─── health() ───────────────────────────────────────────────────────────────

describe("health()", () => {
  test("returns 404 when project not found", async () => {
    ProjectModel.findById.mockResolvedValue(null);

    const req = { params: { id: "missing" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.health(req, res, vi.fn());

    expect(res._status).toBe(404);
  });

  test("returns live: false when project has no render_url", async () => {
    ProjectModel.findById.mockResolvedValue({ ...baseProject, render_url: null });

    const req = { params: { id: "proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.health(req, res, vi.fn());

    expect(res._body).toEqual({ live: false });
  });

  test("checks endpoint, updates project to running if ok, and returns live: true", async () => {
    ProjectModel.findById.mockResolvedValue({ ...baseProject, status: "deploying" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const req = { params: { id: ":proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.health(req, res, vi.fn());

    expect(fetchMock).toHaveBeenCalledWith("https://my-app.onrender.com/api/health", expect.any(Object));
    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", { status: "running" });
    expect(res._body).toEqual({ live: true, url: "https://my-app.onrender.com" });

    vi.unstubAllGlobals();
  });

  test("returns live: false when health check throws network error or timeout", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    const fetchMock = vi.fn().mockRejectedValue(new Error("Timeout"));
    vi.stubGlobal("fetch", fetchMock);

    const req = { params: { id: "proj-1" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.health(req, res, vi.fn());

    expect(res._body).toEqual({ live: false });

    vi.unstubAllGlobals();
  });
});
