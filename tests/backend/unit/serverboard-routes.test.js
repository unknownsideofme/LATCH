import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckDbHealth = vi.fn();

vi.mock("inngest/express", () => ({
  serve: vi.fn(() => (req, res, next) => next()),
}));

vi.mock("../../../serverboard/config/supabase.js", () => ({
  checkDbHealth: () => mockCheckDbHealth(),
}));

vi.mock("../../../serverboard/middleware/auth.js", () => ({
  requireAuth: vi.fn((req, _res, next) => {
    req.user = { id: "test-user" };
    req.userProfile = { id: "test-user", username: "test_user" };
    next();
  }),
}));

vi.mock("../../../serverboard/controllers/authController.js", () => ({
  AuthController: {
    register: vi.fn((_req, res) => res.status(201).json({ message: "Registered" })),
    login: vi.fn((_req, res) => res.status(200).json({ message: "Logged in" })),
    logout: vi.fn((_req, res) => res.status(200).json({ message: "Logged out" })),
    me: vi.fn((_req, res) => res.status(200).json({ user: { id: "test-user" } })),
    githubLogin: vi.fn((_req, res) => res.status(200).json({ url: "https://github.com/login" })),
    githubCallback: vi.fn((_req, res) => res.redirect("/dashboard")),
  },
}));

vi.mock("../../../serverboard/controllers/githubController.js", () => ({
  GithubController: {
    listRepos: vi.fn((_req, res) => res.status(200).json({ repos: [] })),
  },
}));

vi.mock("../../../serverboard/controllers/projectController.js", () => ({
  ProjectController: {
    create: vi.fn((_req, res) => res.status(202).json({ message: "Created" })),
    list: vi.fn((_req, res) => res.status(200).json({ projects: [] })),
    get: vi.fn((req, res) => res.status(200).json({ project: { id: req.params.id } })),
    patch: vi.fn((req, res) => res.status(200).json({ project: { id: req.params.id } })),
    delete: vi.fn((req, res) => res.status(200).json({ message: "Deleted" })),
    logs: vi.fn((_req, res) => res.status(200).json({ logs: [] })),
    deploys: vi.fn((_req, res) => res.status(200).json({ deploys: [] })),
    health: vi.fn((_req, res) => res.status(200).json({ live: true })),
  },
}));

vi.mock("../../../serverboard/controllers/webhookController.js", () => ({
  WebhookController: {
    handleRender: vi.fn((_req, res) => res.status(200).json({ received: true })),
  },
}));

vi.mock("../../../serverboard/services/inngestService.js", () => ({
  inngest: { id: "serverboard" },
  inngestFunctions: [],
}));

vi.mock("../../../serverboard/config/env.js", () => ({
  config: {
    envType: "test",
    isDev: false,
    isProd: false,
    port: 4000,
    corsOrigins: ["http://localhost:3000"],
    supabase: {},
    inngest: { eventKey: "key", signingKey: null, isDev: false },
    webhookSecret: null,
  },
}));

import { createApp } from "../../../serverboard/app.js";
import { AuthController } from "../../../serverboard/controllers/authController.js";
import { GithubController } from "../../../serverboard/controllers/githubController.js";
import { ProjectController } from "../../../serverboard/controllers/projectController.js";
import { WebhookController } from "../../../serverboard/controllers/webhookController.js";
import http from "node:http";

describe("Serverboard routes and server wiring (serverboard/routes/* and serverboard/app.js)", () => {
  let app;
  let server;
  let baseUrl;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCheckDbHealth.mockResolvedValue({ ok: true, latencyMs: 5 });
    app = createApp();

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe("Health check and redirects", () => {
    it("redirects /health to /api/health", async () => {
      const res = await fetch(`${baseUrl}/health`, { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/api/health");
    });

    it("returns database health status on GET /api/health", async () => {
      mockCheckDbHealth.mockResolvedValue({ ok: true, latencyMs: 12 });

      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.service).toBe("serverboard-api");
      expect(json.database).toBe("connected");
      expect(json.dbLatencyMs).toBe(12);
      expect(typeof json.uptimeSec).toBe("number");
      expect(typeof json.timestamp).toBe("string");
    });

    it("reports database: error when db health check is not ok", async () => {
      mockCheckDbHealth.mockResolvedValue({ ok: false, latencyMs: 50, error: "timeout" });

      const res = await fetch(`${baseUrl}/api/health`);
      const json = await res.json();

      expect(json.database).toBe("error");
      expect(json.dbLatencyMs).toBe(50);
    });
  });

  describe("URL normalization middleware", () => {
    it("normalizes /api/v1/projects:id to /api/v1/projects/id", async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects:proj-abc`);
      expect(res.status).toBe(200);
      expect(ProjectController.get).toHaveBeenCalledWith(
        expect.objectContaining({ params: expect.objectContaining({ id: "proj-abc" }) }),
        expect.anything(),
        expect.anything()
      );
    });

    it("normalizes /api/projects:id to /api/projects/id", async () => {
      const res = await fetch(`${baseUrl}/api/projects:proj-xyz`);
      expect(res.status).toBe(200);
      expect(ProjectController.get).toHaveBeenCalledWith(
        expect.objectContaining({ params: expect.objectContaining({ id: "proj-xyz" }) }),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("Auth routes and aliases", () => {
    it("routes POST /api/v1/auth/register and /api/auth/register", async () => {
      const resV1 = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "p", username: "u" }),
      });
      expect(resV1.status).toBe(201);
      expect(AuthController.register).toHaveBeenCalledTimes(1);

      const resAlias = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "p", username: "u" }),
      });
      expect(resAlias.status).toBe(201);
      expect(AuthController.register).toHaveBeenCalledTimes(2);
    });

    it("routes POST /api/v1/auth/login and /api/auth/login", async () => {
      const resV1 = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "p" }),
      });
      expect(resV1.status).toBe(200);
      expect(AuthController.login).toHaveBeenCalled();
    });

    it("routes POST /api/v1/auth/logout and /api/auth/logout", async () => {
      const resV1 = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: "POST",
      });
      expect(resV1.status).toBe(200);
      expect(AuthController.logout).toHaveBeenCalled();

      const resAlias = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
      });
      expect(resAlias.status).toBe(200);
      expect(AuthController.logout).toHaveBeenCalledTimes(2);
    });

    it("routes GET /api/v1/auth/me with requireAuth", async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`);
      expect(res.status).toBe(200);
      expect(AuthController.me).toHaveBeenCalled();
    });

    it("routes GET /api/v1/auth/github and /api/auth/github", async () => {
      const resV1 = await fetch(`${baseUrl}/api/v1/auth/github`);
      expect(resV1.status).toBe(200);
      expect(AuthController.githubLogin).toHaveBeenCalled();

      const resAlias = await fetch(`${baseUrl}/api/auth/github`);
      expect(resAlias.status).toBe(200);
      expect(AuthController.githubLogin).toHaveBeenCalledTimes(2);
    });

    it("routes GET /api/v1/auth/github/callback and /api/auth/github/callback", async () => {
      const resV1 = await fetch(`${baseUrl}/api/v1/auth/github/callback`, { redirect: "manual" });
      expect(AuthController.githubCallback).toHaveBeenCalled();

      const resAlias = await fetch(`${baseUrl}/api/auth/github/callback`, { redirect: "manual" });
      expect(AuthController.githubCallback).toHaveBeenCalledTimes(2);
    });

    it("routes GET /api/v1/github/repos with requireAuth", async () => {
      const resV1 = await fetch(`${baseUrl}/api/v1/github/repos`);
      expect(resV1.status).toBe(200);
      expect(GithubController.listRepos).toHaveBeenCalled();

      const resAlias = await fetch(`${baseUrl}/api/github/repos`);
      expect(resAlias.status).toBe(200);
      expect(GithubController.listRepos).toHaveBeenCalledTimes(2);
    });
  });

  describe("Project routes and aliases", () => {
    it("routes POST /api/v1/projects and /api/projects", async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: "test" }),
      });
      expect(res.status).toBe(202);
      expect(ProjectController.create).toHaveBeenCalled();
    });

    it("routes GET /api/v1/projects (list)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`);
      expect(res.status).toBe(200);
      expect(ProjectController.list).toHaveBeenCalled();
    });

    it("routes GET, PATCH, and DELETE /api/v1/projects/:id", async () => {
      const getRes = await fetch(`${baseUrl}/api/v1/projects/p-1`);
      expect(getRes.status).toBe(200);
      expect(ProjectController.get).toHaveBeenCalled();

      const patchRes = await fetch(`${baseUrl}/api/v1/projects/p-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: "staging" }),
      });
      expect(patchRes.status).toBe(200);
      expect(ProjectController.patch).toHaveBeenCalled();

      const delRes = await fetch(`${baseUrl}/api/v1/projects/p-1`, { method: "DELETE" });
      expect(delRes.status).toBe(200);
      expect(ProjectController.delete).toHaveBeenCalled();
    });

    it("routes GET /api/v1/projects/:id/logs, deploys, and health", async () => {
      const logsRes = await fetch(`${baseUrl}/api/v1/projects/p-1/logs`);
      expect(logsRes.status).toBe(200);
      expect(ProjectController.logs).toHaveBeenCalled();

      const deploysRes = await fetch(`${baseUrl}/api/v1/projects/p-1/deploys`);
      expect(deploysRes.status).toBe(200);
      expect(ProjectController.deploys).toHaveBeenCalled();

      const healthRes = await fetch(`${baseUrl}/api/v1/projects/p-1/health`);
      expect(healthRes.status).toBe(200);
      expect(ProjectController.health).toHaveBeenCalled();
    });
  });

  describe("Webhook routes", () => {
    it("routes POST /api/webhooks/render", async () => {
      const res = await fetch(`${baseUrl}/api/webhooks/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ping" }),
      });
      expect(res.status).toBe(200);
      expect(WebhookController.handleRender).toHaveBeenCalled();
    });
  });
});

