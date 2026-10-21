import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

let spawnCalls = [];
let nextSpawnBehavior = null;

function createMockChildProcess(behavior) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  setImmediate(() => {
    if (behavior.error) {
      child.emit("error", behavior.error);
      return;
    }
    if (behavior.stdout) {
      child.stdout.emit("data", Buffer.from(behavior.stdout));
    }
    if (behavior.stderr) {
      child.stderr.emit("data", Buffer.from(behavior.stderr));
    }
    child.emit("close", behavior.code ?? 0);
  });

  return child;
}

vi.mock("node:child_process", () => ({
  spawn: vi.fn((command, args, options) => {
    spawnCalls.push({ command, args, options });
    const behavior = nextSpawnBehavior || { code: 0, stdout: "{}" };
    return createMockChildProcess(behavior);
  }),
}));

import { RenderService } from "../../../serverboard/services/renderService.js";
import { spawn } from "node:child_process";

describe("RenderService (serverboard/services/renderService.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnCalls = [];
    nextSpawnBehavior = null;
  });

  describe("createService()", () => {
    it("passes expected arguments and parses JSON response", async () => {
      const mockResult = { id: "srv-123", service: { id: "srv-123" } };
      nextSpawnBehavior = { code: 0, stdout: JSON.stringify(mockResult) };

      const result = await RenderService.createService({
        name: "my-service",
        repo: "https://github.com/unknownsideofme/LATCH",
        branch: "develop",
        region: "frankfurt",
        plan: "free",
      });

      expect(spawn).toHaveBeenCalled();
      const call = spawnCalls[0];
      expect(call.command).toBe("render");
      expect(call.args).toEqual([
        "services", "create",
        "--name", "my-service",
        "--type", "web_service",
        "--runtime", "docker",
        "--repo", "https://github.com/unknownsideofme/LATCH",
        "--branch", "develop",
        "--region", "frankfurt",
        "--plan", "free",
        "-o", "json",
        "--confirm",
      ]);
      expect(result).toEqual(mockResult);
    });

    it("uses default branch, region, and plan when optional args are omitted", async () => {
      nextSpawnBehavior = { code: 0, stdout: JSON.stringify({ id: "srv-default" }) };

      await RenderService.createService({
        name: "app",
        repo: "https://github.com/unknownsideofme/LATCH",
      });

      const call = spawnCalls[0];
      expect(call.args).toContain("--branch");
      expect(call.args[call.args.indexOf("--branch") + 1]).toBe("main");
      expect(call.args).toContain("--region");
      expect(call.args[call.args.indexOf("--region") + 1]).toBe("singapore");
      expect(call.args).toContain("--plan");
      expect(call.args[call.args.indexOf("--plan") + 1]).toBe("free");
    });
  });

  describe("deleteService()", () => {
    it("executes render services delete with confirm flag", async () => {
      nextSpawnBehavior = { code: 0, stdout: "Service deleted successfully" };

      const res = await RenderService.deleteService("srv-del-1");

      const call = spawnCalls[0];
      expect(call.args).toEqual([
        "services", "delete", "srv-del-1", "--confirm", "-o", "json",
      ]);
      expect(res).toBe("Service deleted successfully");
    });
  });

  describe("getLogs()", () => {
    it("parses JSON formatted logs", async () => {
      const logsArray = [{ message: "Connected to database" }, { message: "Ready on port 3000" }];
      nextSpawnBehavior = { code: 0, stdout: JSON.stringify(logsArray) };

      const res = await RenderService.getLogs("srv-logs", { limit: 50 });

      const call = spawnCalls[0];
      expect(call.args).toEqual([
        "logs", "--resources", "srv-logs", "--limit", "50", "-o", "json",
      ]);
      expect(res).toEqual(logsArray);
    });

    it("falls back to splitting line-by-line when stdout is plain text instead of JSON", async () => {
      const plainTextLogs = "Line 1 output\nLine 2 output\nLine 3 output";
      nextSpawnBehavior = { code: 0, stdout: plainTextLogs };

      const res = await RenderService.getLogs("srv-logs");

      expect(res).toEqual([
        { message: "Line 1 output" },
        { message: "Line 2 output" },
        { message: "Line 3 output" },
      ]);
    });
  });

  describe("getDeploys()", () => {
    it("lists deploys for service as parsed JSON", async () => {
      const deploys = [{ id: "dep-1", status: "live" }, { id: "dep-2", status: "build_in_progress" }];
      nextSpawnBehavior = { code: 0, stdout: JSON.stringify(deploys) };

      const res = await RenderService.getDeploys("srv-deploys");

      const call = spawnCalls[0];
      expect(call.args).toEqual(["deploys", "list", "srv-deploys", "-o", "json"]);
      expect(res).toEqual(deploys);
    });
  });

  describe("updateService()", () => {
    it("includes optional branch, name, and plan arguments", async () => {
      nextSpawnBehavior = { code: 0, stdout: JSON.stringify({ id: "srv-up", branch: "staging" }) };

      const res = await RenderService.updateService("srv-up", {
        branch: "staging",
        name: "renamed-app",
        plan: "starter",
      });

      const call = spawnCalls[0];
      expect(call.args).toEqual([
        "services", "update", "srv-up",
        "--branch", "staging",
        "--name", "renamed-app",
        "--plan", "starter",
        "--confirm", "-o", "json",
      ]);
      expect(res).toEqual({ id: "srv-up", branch: "staging" });
    });

    it("falls back to { success: true, raw: output } when update response is not JSON", async () => {
      nextSpawnBehavior = { code: 0, stdout: "Service updated successfully (plain text)" };

      const res = await RenderService.updateService("srv-up", { branch: "main" });

      expect(res).toEqual({
        success: true,
        raw: "Service updated successfully (plain text)",
      });
    });
  });

  describe("CLI error handling in runCli", () => {
    it("rejects with stderr message when CLI exits with non-zero code", async () => {
      nextSpawnBehavior = {
        code: 1,
        stderr: "Error: Service 'srv-notfound' not found on Render",
      };

      await expect(RenderService.deleteService("srv-notfound")).rejects.toThrow(
        "Error: Service 'srv-notfound' not found on Render"
      );
    });

    it("rejects with default message when non-zero exit has empty stderr", async () => {
      nextSpawnBehavior = {
        code: 127,
        stderr: "",
      };

      await expect(RenderService.deleteService("srv-x")).rejects.toThrow(
        "Render CLI process exited with code 127"
      );
    });

    it("rejects with timeout message when child process emits ETIMEDOUT error", async () => {
      const timeoutErr = new Error("Command timed out");
      timeoutErr.code = "ETIMEDOUT";
      nextSpawnBehavior = { error: timeoutErr };

      await expect(RenderService.getDeploys("srv-slow")).rejects.toThrow(
        /Render CLI operation timed out after \d+ms/
      );
    });

    it("rejects with timeout message when child process emits AbortError", async () => {
      const abortErr = new Error("The operation was aborted");
      abortErr.name = "AbortError";
      nextSpawnBehavior = { error: abortErr };

      await expect(RenderService.getDeploys("srv-abort")).rejects.toThrow(
        /Render CLI operation timed out after \d+ms/
      );
    });

    it("rejects with original error when child process emits generic spawn error", async () => {
      const spawnErr = new Error("spawn render ENOENT");
      spawnErr.code = "ENOENT";
      nextSpawnBehavior = { error: spawnErr };

      await expect(RenderService.getDeploys("srv-enoent")).rejects.toThrow(
        "spawn render ENOENT"
      );
    });
  });
});

