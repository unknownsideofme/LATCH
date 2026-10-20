
vi.mock("../../../serverboard/models/Project.js", () => ({
  ProjectModel: {
    findById: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    countByUser: vi.fn(),
    listByUser: vi.fn(async () => []),
  },
}));
vi.mock("../../../serverboard/services/renderService.js", () => ({
  RenderService: { updateService: vi.fn() },
}));
vi.mock("../../../serverboard/services/inngestService.js", () => ({
  inngest: { send: vi.fn(async () => ({ ids: ["evt-1"] })) },
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

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

const baseProject = {
  id: "proj-1",
  user_id: "user-1",
  render_id: "render-1",
  branch: "main",
  status: "running",
  render_url: null,
};

beforeEach(() => vi.clearAllMocks());

// ─── patch() ────────────────────────────────────────────────────────────────

describe("patch()", () => {
  test("branch-only PATCH persists the new branch to the database", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);
    RenderService.updateService.mockResolvedValue({});
    ProjectModel.update.mockResolvedValue({ ...baseProject, branch: "feature-x" });

    const req = { params: { id: "proj-1" }, body: { branch: "feature-x" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", expect.objectContaining({ branch: "feature-x" }));
    expect(res._status).toBe(200);
  });

  test("invalid branch returns 400", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);

    const req = { params: { id: "proj-1" }, body: { branch: "bad branch!" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(ProjectModel.update).not.toHaveBeenCalled();
  });

  test("failed Render update returns 502 instead of success", async () => {
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

  test("invalid agent_limit returns 400", async () => {
    ProjectModel.findById.mockResolvedValue(baseProject);

    const req = { params: { id: "proj-1" }, body: { agent_limit: 99 }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(400);
  });

  test("returns 404 when project not found", async () => {
    ProjectModel.findById.mockResolvedValue(null);

    const req = { params: { id: "missing" }, body: { branch: "main" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.patch(req, res, vi.fn());

    expect(res._status).toBe(404);
  });
});

// ─── create() ───────────────────────────────────────────────────────────────

describe("create() — repository type safety", () => {
  const validBody = { projectName: "my-app" };

  test("object repo value returns 400", async () => {
    const req = { body: { ...validBody, repo: { url: "x" } }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(400);
    expect(res._body.error).toBe("validation_error");
    expect(res._body.message).toMatch(/string/i);
  });

  test("array repo value returns 400", async () => {
    const req = { body: { ...validBody, repo: ["https://github.com/unknownsideofme/LATCH"] }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(400);
  });

  test("numeric repo value returns 400", async () => {
    const req = { body: { ...validBody, repo: 12345 }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(400);
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

  test("disallowed repo URL returns 400", async () => {
    const req = { body: { ...validBody, repo: "https://github.com/other/repo" }, user: { id: "user-1" } };
    const res = makeRes();
    await ProjectController.create(req, res, vi.fn());

    expect(res._status).toBe(400);
  });
});

// ─── env config validation (issue #34) ──────────────────────────────────────

describe("env.js config shape", () => {
  test("config exports required keys with correct types", async () => {
    const { config } = await import("../../../serverboard/config/env.js");
    expect(typeof config.isDev).toBe("boolean");
    expect(typeof config.isProd).toBe("boolean");
    expect(typeof config.port).toBe("number");
    expect(Array.isArray(config.corsOrigins)).toBe(true);
    expect(typeof config.supabase).toBe("object");
  });
});
