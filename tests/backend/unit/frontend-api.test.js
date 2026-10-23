import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../../frontend/lib/api.ts";

describe("Frontend API client (frontend/lib/api.ts)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("auth.register()", () => {
    it("calls /api/v1/auth/register and returns user profile", async () => {
      const mockResponse = {
        message: "Registered successfully",
        user: { id: "u-1", email: "test@example.com", username: "tester" },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockResponse,
      });

      const res = await api.auth.register({
        email: "test@example.com",
        password: "password123",
        username: "tester",
      });

      expect(res).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/register"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
    });

    it("throws ApiError when registration fails with error message", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ error: "validation_error", message: "Email already taken" }),
      });

      await expect(
        api.auth.register({
          email: "taken@example.com",
          password: "password123",
          username: "taken",
        })
      ).rejects.toThrow("Email already taken");
    });
  });

  describe("auth.login()", () => {
    it("returns the session payload from the versioned login endpoint", async () => {
      const mockResponse = {
        message: "Logged in successfully",
        session: { access_token: "jwt-token-xyz" },
        user: { id: "u-2", email: "login@example.com" },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockResponse,
      });

      const res = await api.auth.login({
        email: "login@example.com",
        password: "secret",
      });

      expect(res).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/login"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ email: "login@example.com", password: "secret" }),
        })
      );
    });
  });

  describe("auth.logout()", () => {
    it("calls /api/v1/auth/logout with POST method and clears localStorage", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ message: "Logged out successfully" }),
      });

      const removeItem = vi.fn();
      const storage = { removeItem };
      vi.stubGlobal("window", { localStorage: storage });
      vi.stubGlobal("localStorage", storage);

      await api.auth.logout();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/logout"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
      expect(removeItem).toHaveBeenCalledWith("latch_token");
      expect(removeItem).toHaveBeenCalledWith("latch_user_session");
    });
  });

  describe("auth.me()", () => {
    it("fetches user profile from /api/v1/auth/me", async () => {
      const mockUser = { id: "u-1", email: "me@example.com", username: "me" };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ user: mockUser }),
      });

      const res = await api.auth.me();
      expect(res.user).toEqual(mockUser);
    });
  });

  describe("github.listRepos()", () => {
    it("calls /api/v1/github/repos and returns repository list", async () => {
      const mockRepos = [{ id: 1, full_name: "org/repo" }];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ repos: mockRepos }),
      });

      const res = await api.github.listRepos();
      expect(res.repos).toEqual(mockRepos);
    });
  });

  describe("projects endpoints", () => {
    it("projects.list() calls /api/v1/projects", async () => {
      const mockProjects = [{ id: "p-1", project_name: "Project Alpha" }];
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ projects: mockProjects }),
      });

      const res = await api.projects.list();
      expect(res.projects).toEqual(mockProjects);
    });

    it("projects.get() calls /api/v1/projects/:id", async () => {
      const mockProject = { id: "p-1", project_name: "Project Alpha" };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ project: mockProject }),
      });

      const res = await api.projects.get("p-1");
      expect(res.project).toEqual(mockProject);
    });

    it("projects.create() POSTs payload to /api/v1/projects", async () => {
      const mockResponse = {
        message: "Project created",
        project: { id: "p-new", project_name: "Beta" },
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockResponse,
      });

      const res = await api.projects.create({ projectName: "Beta" });
      expect(res).toEqual(mockResponse);
    });

    it("projects.update() PATCHes updates to /api/v1/projects/:id", async () => {
      const mockResponse = {
        message: "Project updated",
        project: { id: "p-1", project_name: "Beta Updated" },
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockResponse,
      });

      const res = await api.projects.update("p-1", { project_name: "Beta Updated" });
      expect(res).toEqual(mockResponse);
    });

    it("projects.delete() sends DELETE to /api/v1/projects/:id", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ message: "Deleted" }),
      });

      const res = await api.projects.delete("p-1");
      expect(res.message).toBe("Deleted");
    });

    it("projects.getLogs() calls /api/v1/projects/:id/logs", async () => {
      const mockLogs = [{ text: "Log entry 1" }];
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ logs: mockLogs }),
      });

      const res = await api.projects.getLogs("p-1", 20);
      expect(res.logs).toEqual(mockLogs);
    });

    it("projects.getDeploys() calls /api/v1/projects/:id/deploys", async () => {
      const mockDeploys = [{ id: "dep-1", status: "live" }];
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ deploys: mockDeploys }),
      });

      const res = await api.projects.getDeploys("p-1");
      expect(res.deploys).toEqual(mockDeploys);
    });

    it("projects.getHealth() calls /api/v1/projects/:id/health", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ live: true, url: "https://demo.onrender.com" }),
      });

      const res = await api.projects.getHealth("p-1");
      expect(res.live).toBe(true);
    });
  });
});
