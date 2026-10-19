import { spawn } from "node:child_process";

function runCli(args, timeoutMs = 60_000) {
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

export const RenderService = {
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
};
