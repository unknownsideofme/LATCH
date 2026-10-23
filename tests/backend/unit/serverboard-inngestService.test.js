import { beforeEach, describe, expect, it, vi } from "vitest";

const { createdFunctions } = vi.hoisted(() => ({
  createdFunctions: [],
}));

vi.mock("inngest", () => {
  return {
    Inngest: class {
      constructor(opts) {
        this.opts = opts;
      }
      createFunction(config, fn) {
        const fnObj = { config, fn };
        createdFunctions.push(fnObj);
        return fnObj;
      }
    },
  };
});

vi.mock("../../../serverboard/models/Project.js", () => ({
  ProjectModel: {
    findById: vi.fn(),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
}));

vi.mock("../../../serverboard/services/renderService.js", () => ({
  RenderService: {
    createService: vi.fn(),
    deleteService: vi.fn(),
  },
}));

vi.mock("../../../serverboard/config/env.js", () => ({
  config: {
    inngest: { eventKey: "test-event-key" },
    isDev: false,
  },
}));

import {
  createRenderFunction,
  deleteRenderFunction,
  inngestFunctions,
  runProvisioningWorker,
  runTeardownWorker,
} from "../../../serverboard/services/inngestService.js";
import { ProjectModel } from "../../../serverboard/models/Project.js";
import { RenderService } from "../../../serverboard/services/renderService.js";

function createMockStep() {
  return {
    run: vi.fn(async (_name, fn) => fn()),
    sleep: vi.fn(async () => {}),
  };
}

describe("inngestService (serverboard/services/inngestService.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Inngest function registration", () => {
    it("registers createRenderFunction and deleteRenderFunction in inngestFunctions array", () => {
      expect(inngestFunctions).toHaveLength(2);
      expect(createRenderFunction.config.id).toBe("create-render-service");
      expect(deleteRenderFunction.config.id).toBe("delete-render-service");
    });
  });

  describe("createRenderFunction", () => {
    it("has expected triggers and retry configuration", () => {
      expect(createRenderFunction.config.triggers).toEqual([{ event: "project/create" }]);
      expect(createRenderFunction.config.retries).toBe(2);
    });

    it("onFailure callback marks project as failed", async () => {
      const event = {
        data: {
          event: {
            data: {
              projectId: "proj-failed-event",
            },
          },
        },
      };

      await createRenderFunction.config.onFailure({ event });

      expect(ProjectModel.update).toHaveBeenCalledWith("proj-failed-event", { status: "failed" });
    });

    it("successfully provisions, polls health, and marks project running when live", async () => {
      const step = createMockStep();
      const event = {
        data: {
          projectId: "proj-1",
          payload: { name: "test-app", repo: "https://github.com/unknownsideofme/LATCH" },
        },
      };

      RenderService.createService.mockResolvedValue({
        id: "rnd-srv-1",
        serviceDetails: { url: "https://test-app.onrender.com" },
      });

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", fetchMock);

      const result = await createRenderFunction.fn({ event, step });

      expect(step.run).toHaveBeenCalledWith("mark-deploying", expect.any(Function));
      expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", { status: "deploying" });
      expect(step.run).toHaveBeenCalledWith("provision", expect.any(Function));
      expect(RenderService.createService).toHaveBeenCalledWith(event.data.payload);
      expect(step.run).toHaveBeenCalledWith("save-render-data", expect.any(Function));
      expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", {
        render_id: "rnd-srv-1",
        render_url: "https://test-app.onrender.com",
        status: "deploying",
      });
      expect(step.run).toHaveBeenCalledWith("mark-running", expect.any(Function));
      expect(ProjectModel.update).toHaveBeenCalledWith("proj-1", { status: "running" });

      expect(result).toEqual({
        renderId: "rnd-srv-1",
        renderUrl: "https://test-app.onrender.com",
        live: true,
      });

      vi.unstubAllGlobals();
    });

    it("throws error when Render provisioning response lacks service ID", async () => {
      const step = createMockStep();
      const event = {
        data: {
          projectId: "proj-missing-id",
          payload: { name: "bad-app" },
        },
      };

      RenderService.createService.mockResolvedValue({});

      await expect(createRenderFunction.fn({ event, step })).rejects.toThrow(
        "Render provisioning response missing service id"
      );
    });

    it("marks project failed when health checks exceed max checks", async () => {
      const step = createMockStep();
      const event = {
        data: {
          projectId: "proj-timeout",
          payload: { name: "slow-app" },
        },
      };

      RenderService.createService.mockResolvedValue({
        id: "rnd-srv-timeout",
        url: "https://slow-app.onrender.com",
      });

      // Health check always fails
      const fetchMock = vi.fn().mockRejectedValue(new Error("Connection refused"));
      vi.stubGlobal("fetch", fetchMock);

      const result = await createRenderFunction.fn({ event, step });

      expect(step.run).toHaveBeenCalledWith("mark-timeout-failed", expect.any(Function));
      expect(ProjectModel.update).toHaveBeenCalledWith("proj-timeout", { status: "failed" });
      expect(result).toEqual({
        renderId: "rnd-srv-timeout",
        renderUrl: "https://slow-app.onrender.com",
        live: false,
      });

      vi.unstubAllGlobals();
    });
  });

  describe("deleteRenderFunction", () => {
    it("deletes Render service and database record", async () => {
      const step = createMockStep();
      const event = {
        data: {
          projectId: "proj-del",
          renderId: "rnd-del",
        },
      };

      const result = await deleteRenderFunction.fn({ event, step });

      expect(step.run).toHaveBeenCalledWith("delete-render", expect.any(Function));
      expect(RenderService.deleteService).toHaveBeenCalledWith("rnd-del");
      expect(step.run).toHaveBeenCalledWith("delete-db-project", expect.any(Function));
      expect(ProjectModel.delete).toHaveBeenCalledWith("proj-del");
      expect(result).toEqual({ success: true });
    });

    it("handles missing renderId gracefully by only deleting from database", async () => {
      const step = createMockStep();
      const event = {
        data: {
          projectId: "proj-only-db",
        },
      };

      await deleteRenderFunction.fn({ event, step });

      expect(RenderService.deleteService).not.toHaveBeenCalled();
      expect(ProjectModel.delete).toHaveBeenCalledWith("proj-only-db");
    });
  });

  describe("runProvisioningWorker()", () => {
    it("skips provisioning if project does not exist", async () => {
      ProjectModel.findById.mockResolvedValue(null);

      await runProvisioningWorker("proj-none", { name: "app" });

      expect(RenderService.createService).not.toHaveBeenCalled();
    });

    test.each(["deploying", "running"])("skips provisioning if project status is already '%s'", async (st) => {
      ProjectModel.findById.mockResolvedValue({ id: "p-active", status: st });

      await runProvisioningWorker("p-active", { name: "app" });

      expect(RenderService.createService).not.toHaveBeenCalled();
    });

    it("successfully provisions service and marks running when health check succeeds", async () => {
      vi.useFakeTimers();
      ProjectModel.findById.mockResolvedValue({ id: "p-ok", status: "pending" });
      RenderService.createService.mockResolvedValue({
        id: "rnd-ok-1",
        url: "https://ok-app.onrender.com",
      });

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", fetchMock);

      const promise = runProvisioningWorker("p-ok", { name: "ok-app" });
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(ProjectModel.update).toHaveBeenCalledWith("p-ok", {
        render_id: "rnd-ok-1",
        render_url: "https://ok-app.onrender.com",
        status: "deploying",
      });
      expect(ProjectModel.update).toHaveBeenCalledWith("p-ok", { status: "running" });

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("marks failed when Render createService returns no id in runProvisioningWorker", async () => {
      ProjectModel.findById.mockResolvedValue({ id: "p-noid", status: "pending" });
      RenderService.createService.mockResolvedValue({});

      await runProvisioningWorker("p-noid", { name: "noid-app" });

      expect(ProjectModel.update).toHaveBeenCalledWith("p-noid", { status: "failed" });
    });

    it("catches errors and marks project status as failed on provisioning failure", async () => {
      ProjectModel.findById.mockResolvedValue({ id: "p-fail", status: "pending" });
      RenderService.createService.mockRejectedValue(new Error("Render API rate limit"));

      await runProvisioningWorker("p-fail", { name: "fail-app" });

      expect(ProjectModel.update).toHaveBeenCalledWith("p-fail", { status: "failed" });
    });
  });

  describe("runTeardownWorker()", () => {
    it("deletes service from Render and removes project from database", async () => {
      RenderService.deleteService.mockResolvedValue("deleted");
      ProjectModel.delete.mockResolvedValue(true);

      const result = await runTeardownWorker("proj-td", "rnd-td");

      expect(RenderService.deleteService).toHaveBeenCalledWith("rnd-td");
      expect(ProjectModel.delete).toHaveBeenCalledWith("proj-td");
      expect(result).toEqual({ success: true });
    });

    it("ignores 404/not found errors from Render and continues deleting DB project", async () => {
      RenderService.deleteService.mockRejectedValue(new Error("Service 'rnd-404' does not exist (404)"));
      ProjectModel.delete.mockResolvedValue(true);

      const result = await runTeardownWorker("proj-td-404", "rnd-404");

      expect(ProjectModel.delete).toHaveBeenCalledWith("proj-td-404");
      expect(result).toEqual({ success: true });
    });

    it("skips Render teardown and deletes DB project when render_id is local stub srv-local-", async () => {
      RenderService.deleteService.mockClear();
      ProjectModel.delete.mockResolvedValue(true);

      const result = await runTeardownWorker("proj-local", "srv-local-abc123");

      expect(RenderService.deleteService).not.toHaveBeenCalled();
      expect(ProjectModel.delete).toHaveBeenCalledWith("proj-local");
      expect(result).toEqual({ success: true });
    });

    it("ignores ENOENT spawn errors when Render CLI is not installed and deletes DB project", async () => {
      RenderService.deleteService.mockRejectedValue(new Error("spawn render ENOENT"));
      ProjectModel.delete.mockResolvedValue(true);

      const result = await runTeardownWorker("proj-no-cli", "srv-remote-123");

      expect(ProjectModel.delete).toHaveBeenCalledWith("proj-no-cli");
      expect(result).toEqual({ success: true });
    });

    it("throws error and does not delete DB project when Render teardown fails with non-404 error", async () => {
      RenderService.deleteService.mockRejectedValue(new Error("Render internal server error 500"));

      await expect(runTeardownWorker("proj-err", "rnd-err")).rejects.toThrow(
        "Failed to delete Render service: Render internal server error 500"
      );
      expect(ProjectModel.delete).not.toHaveBeenCalled();
    });
  });
});

