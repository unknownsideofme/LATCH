import { spawn } from "node:child_process";

function runRawCli(args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const child = spawn("render", args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      killSignal: "SIGKILL",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", d => (stdout += d.toString()));
    child.stderr.on("data", d => (stderr += d.toString()));

    child.on("close", code => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Render CLI process exited with code ${code}`));
      }
    });

    child.on("error", err => {
      if (err.name === "AbortError" || err.code === "ETIMEDOUT") {
        reject(new Error(`Render CLI operation timed out after ${timeoutMs}ms`));
      } else {
        reject(err);
      }
    });
  });
}

async function runCli(args, timeoutMs = 60_000, retryOnMissingWorkspace = true) {
  try {
    return await runRawCli(args, timeoutMs);
  } catch (err) {
    if (retryOnMissingWorkspace && /no workspace set/i.test(err.message)) {
      console.warn("[renderService] No workspace set detected, auto-configuring workspace...");
      const initialized = await RenderService.ensureWorkspace();
      if (initialized) {
        return await runRawCli(args, timeoutMs);
      }
    }
    throw err;
  }
}

export const RenderService = {
  async ensureWorkspace() {
    try {
      const current = await runRawCli(["workspace", "current"]);
      if (current && !/no workspace set/i.test(current)) {
        return true;
      }
    } catch {
      // workspace not set
    }

    try {
      if (process.env.RENDER_WORKSPACE_ID) {
        await runRawCli(["workspace", "set", process.env.RENDER_WORKSPACE_ID]);
        return true;
      }
      const out = await runRawCli(["workspaces", "-o", "json"]);
      const list = JSON.parse(out);
      if (Array.isArray(list) && list.length > 0) {
        const wsId = list[0].id || list[0].name;
        if (wsId) {
          await runRawCli(["workspace", "set", wsId]);
          return true;
        }
      }
    } catch (wsErr) {
      console.warn("[renderService] Auto-workspace setup failed:", wsErr.message);
    }
    return false;
  },

  async createService({ name, repo, branch = "main", region = "singapore", plan = "free" }) {
    const args = [
      "services", "create",
      "--name", name,
      "--type", "web_service",
      "--runtime", "docker",
      "--repo", repo,
      "--branch", branch,
      "--region", region,
      "--plan", plan,
      "-o", "json",
      "--confirm",
    ];
    const output = await runCli(args);
    return JSON.parse(output);
  },

  async deleteService(serviceId) {
    return await runCli(["services", "delete", serviceId, "--confirm", "-o", "json"]);
  },

  async getLogs(serviceId, { limit = 100 } = {}) {
    const output = await runCli(["logs", "--resources", serviceId, "--limit", String(limit), "-o", "json"]);
    try {
      return JSON.parse(output);
    } catch {
      return output.split("\n").map(l => ({ message: l }));
    }
  },

  async getDeploys(serviceId) {
    const output = await runCli(["deploys", "list", serviceId, "-o", "json"]);
    return JSON.parse(output);
  },

  async updateService(serviceId, { branch, name, plan } = {}) {
    const args = ["services", "update", serviceId];
    if (branch) args.push("--branch", branch);
    if (name) args.push("--name", name);
    if (plan) args.push("--plan", plan);
    args.push("--confirm", "-o", "json");
    const output = await runCli(args);
    try {
      return JSON.parse(output);
    } catch {
      return { success: true, raw: output };
    }
  },
};
